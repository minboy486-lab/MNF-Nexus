import WebSocket from "ws";
import { hostname as osHostname } from "node:os";
import {
  LAN_CLUSTER_PATH,
  REMOTE_PORT,
  type RemoteClientMsg,
  type RemotePeerSnapshot,
  type RemoteServerMsg,
} from "../../shared/remote";
import type { AppSnapshot, YeoksamRole } from "../../shared/types";
import type { ShopTimerThemePayload } from "../../shared/timerLook";
import type { TableTimerState } from "@mnf/timer/types";
import { discoverLanCluster, type LanClusterHello } from "./lanDiscover";
import { listLanIPv4 } from "./lan";
import { YEOKSAM_VENUE_ID, isKnownVenueId } from "@mnf/venue";
import { isYeoksamFloor } from "../../shared/floorPlan";

const TICK_MS = 8000;
const EMPTY_SNAP: AppSnapshot = {
  sessions: [],
  monitorAssignments: {},
  tableAssignments: {},
};

export function normalizeRemoteIp(addr: string | undefined | null): string {
  if (!addr) return "";
  if (addr.startsWith("::ffff:")) return addr.slice(7);
  if (addr === "::1") return "127.0.0.1";
  return addr;
}

function clusterVenueId(id?: string): string {
  return isKnownVenueId(id) ? id : YEOKSAM_VENUE_ID;
}

function isPin(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}$/.test(v);
}

function clusterRank(a: { hostname: string; host: string }, b: { hostname: string; host: string }): number {
  const h = a.hostname.localeCompare(b.hostname, undefined, { sensitivity: "base" });
  if (h !== 0) return h;
  return a.host.localeCompare(b.host);
}

function snapshotSessionCount(snap?: AppSnapshot | null): number {
  return snap?.sessions?.length ?? 0;
}

function hubRank(
  a: { sessions: number; hostname: string; host: string },
  b: { sessions: number; hostname: string; host: string },
): number {
  if (b.sessions !== a.sessions) return b.sessions - a.sessions;
  return clusterRank(a, b);
}

export class LanCluster {
  private closed = true;
  private timer: ReturnType<typeof setInterval> | null = null;
  private kick: ReturnType<typeof setTimeout> | null = null;
  private outbound = new Map<string, WebSocket>();
  private inbound = new Map<string, WebSocket>();
  private cache = new Map<string, RemotePeerSnapshot>();
  private connecting = new Set<string>();
  private ownHosts = new Set<string>();
  private lastFound: LanClusterHello[] = [];
  private fullScanAt = 0;
  private ticks = 0;

  constructor(
    private opts: {
      getPin: () => string;
      adoptPin: (pin: string) => void;
      hostname: () => string;
      getVenueId: () => string;
      getYeoksamRole: () => YeoksamRole;
      getLocalSnapshot: () => {
        snapshot: AppSnapshot;
        timers: TableTimerState[];
        serverNow: number;
        hostname: string;
        yeoksamRole?: YeoksamRole;
      };
      getOwnedSnapshot: () => {
        snapshot: AppSnapshot;
        timers: TableTimerState[];
        serverNow: number;
        hostname: string;
      };
      getShopTimerTheme: () => ShopTimerThemePayload | null;
      onPeersChange: () => void;
    },
  ) {}

  start(): void {
    this.stop();
    this.closed = false;
    void this.tick();
    this.kick = setTimeout(() => {
      if (!this.closed) void this.tick();
    }, 2000);
    this.timer = setInterval(() => {
      if (!this.closed) void this.tick();
    }, TICK_MS);
  }

  stop(): void {
    this.closed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.kick) {
      clearTimeout(this.kick);
      this.kick = null;
    }
    for (const ws of this.outbound.values()) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.outbound.clear();
    this.inbound.clear();
    this.connecting.clear();
    this.cache.clear();
    this.lastFound = [];
    this.fullScanAt = 0;
    this.ticks = 0;
  }

  peers(): RemotePeerSnapshot[] {
    return [...this.cache.values()];
  }

  isOwnHost(host?: string): boolean {
    if (!host) return true;
    return this.ownHosts.has(host);
  }

  noteInbound(host: string, ws: WebSocket): void {
    const ip = normalizeRemoteIp(host);
    if (!ip || this.ownHosts.has(ip)) return;
    this.inbound.set(ip, ws);
  }

  dropSocket(ws: WebSocket): void {
    for (const [host, sock] of this.inbound) {
      if (sock === ws) this.inbound.delete(host);
    }
  }

  rememberPeer(host: string, snap: RemotePeerSnapshot): void {
    const ip = normalizeRemoteIp(host);
    if (!ip || this.ownHosts.has(ip)) return;
    const prev = this.cache.get(ip);
    this.cache.set(ip, {
      host: ip,
      hostname: snap.hostname || prev?.hostname || ip,
      snapshot: snap.snapshot ?? prev?.snapshot ?? EMPTY_SNAP,
      timers: snap.timers ?? prev?.timers ?? [],
      serverNow: typeof snap.serverNow === "number" ? snap.serverNow : (prev?.serverNow ?? Date.now()),
      yeoksamRole: snap.yeoksamRole ?? prev?.yeoksamRole,
      timerTheme: snap.timerTheme ?? prev?.timerTheme,
    });
    if (
      !prev ||
      prev.serverNow !== snap.serverNow ||
      prev.hostname !== snap.hostname ||
      prev.yeoksamRole !== snap.yeoksamRole ||
      prev.snapshot !== snap.snapshot ||
      prev.timers !== snap.timers ||
      prev.timerTheme !== snap.timerTheme
    ) {
      this.opts.onPeersChange();
    }
  }

  notePeerRole(host: string, role?: YeoksamRole, hostname?: string): void {
    const ip = normalizeRemoteIp(host);
    if (!ip || this.ownHosts.has(ip)) return;
    const prev = this.cache.get(ip);
    if (!prev) {
      this.cache.set(ip, {
        host: ip,
        hostname: hostname?.trim() || ip,
        snapshot: EMPTY_SNAP,
        timers: [],
        serverNow: Date.now(),
        yeoksamRole: role,
      });
      this.opts.onPeersChange();
      return;
    }
    const nextRole = role ?? prev.yeoksamRole;
    const nextName = hostname?.trim() || prev.hostname;
    if (nextRole === prev.yeoksamRole && nextName === prev.hostname) return;
    this.cache.set(ip, { ...prev, yeoksamRole: nextRole, hostname: nextName });
    this.opts.onPeersChange();
  }

  forgetHost(host: string): void {
    const ip = normalizeRemoteIp(host);
    if (!ip) return;
    if (this.cache.delete(ip)) this.opts.onPeersChange();
  }

  forward(host: string, msg: RemoteClientMsg): boolean {
    const ip = normalizeRemoteIp(host);
    const ws = this.outbound.get(ip) ?? this.inbound.get(ip);
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }

  shopMaster(): { self: true } | { self: false; peer: RemotePeerSnapshot } {
    const selfHost = [...this.ownHosts][0] ?? "0.0.0.0";
    const selfName = this.opts.hostname() || osHostname() || "pc";
    const selfRole = this.opts.getYeoksamRole();
    const selfSessions = snapshotSessionCount(this.opts.getOwnedSnapshot().snapshot);
    const hubs: Array<{
      hostname: string;
      host: string;
      self: boolean;
      sessions: number;
      peer?: RemotePeerSnapshot;
    }> = [];
    if (selfRole === "control") {
      hubs.push({ hostname: selfName, host: selfHost, self: true, sessions: selfSessions });
    }
    for (const p of this.cache.values()) {
      if (p.yeoksamRole !== "control") continue;
      hubs.push({
        hostname: p.hostname,
        host: p.host,
        self: false,
        sessions: snapshotSessionCount(p.snapshot),
        peer: p,
      });
    }
    const bestPeerSessions = hubs.reduce((max, h) => (h.self ? max : Math.max(max, h.sessions)), 0);
    // 출력으로 저장된 PC라도 이 PC에 게임이 더 많으면 허브를 유지한다 (관리자→Ct 전환).
    if (selfRole !== "control" && selfSessions > 0 && selfSessions > bestPeerSessions) {
      return { self: true };
    }
    if (hubs.length === 0) return { self: true };
    hubs.sort((a, b) => hubRank(a, b));
    const winner = hubs[0];
    if (!winner || winner.self || !winner.peer) return { self: true };
    if (selfSessions > winner.sessions) return { self: true };
    return { self: false, peer: winner.peer };
  }

  isShopFollower(): boolean {
    if (!isYeoksamFloor(this.opts.getVenueId())) return false;
    return !this.shopMaster().self;
  }

  yeoksamControlPeer(): RemotePeerSnapshot | null {
    const master = this.shopMaster();
    if (master.self) return null;
    return master.peer;
  }

  forwardToYeoksamControl(msg: RemoteClientMsg): boolean {
    const peer = this.yeoksamControlPeer();
    if (!peer) return false;
    return this.forward(peer.host, msg);
  }

  broadcastToPeers(msg: RemoteClientMsg): void {
    const raw = JSON.stringify(msg);
    const seen = new Set<WebSocket>();
    for (const ws of [...this.outbound.values(), ...this.inbound.values()]) {
      if (seen.has(ws) || ws.readyState !== WebSocket.OPEN) continue;
      seen.add(ws);
      ws.send(raw);
    }
  }

  pushLocalSnapshot(): void {
    if (this.isShopFollower()) return;
    const local = this.opts.getOwnedSnapshot();
    const timerTheme = this.opts.getShopTimerTheme() ?? undefined;
    const msg: RemoteClientMsg = {
      type: "peer_snapshot",
      hostname: local.hostname,
      snapshot: local.snapshot,
      timers: local.timers,
      serverNow: local.serverNow,
      yeoksamRole: this.opts.getYeoksamRole(),
      timerTheme,
    };
    const raw = JSON.stringify(msg);
    for (const ws of this.outbound.values()) {
      if (ws.readyState === WebSocket.OPEN) ws.send(raw);
    }
  }

  private async tick(): Promise<void> {
    if (this.closed) return;
    const mine = await listLanIPv4();
    this.ownHosts = new Set(mine);
    const now = Date.now();
    if (this.ticks < 5 || now - this.fullScanAt > 25_000) {
      this.lastFound = await discoverLanCluster();
      this.fullScanAt = now;
    }
    this.ticks += 1;
    const others = this.lastFound.filter(
      (p) => !this.ownHosts.has(p.host) && clusterVenueId(p.venueId) === clusterVenueId(this.opts.getVenueId()),
    );
    this.syncPin(mine[0] ?? "0.0.0.0", others);
    const live = new Set(others.map((p) => p.host));
    for (const host of live) this.ensureOutbound(host);
    for (const host of [...this.cache.keys()]) {
      if (live.has(host) || this.outbound.has(host) || this.inbound.has(host)) continue;
      this.cache.delete(host);
      this.opts.onPeersChange();
    }
  }

  private syncPin(selfHost: string, others: LanClusterHello[]): void {
    const selfName = this.opts.hostname() || osHostname() || "pc";
    const rows = [
      { hostname: selfName, host: selfHost, pin: this.opts.getPin() },
      ...others,
    ];
    const winner = [...rows].sort(clusterRank)[0];
    if (!winner || !isPin(winner.pin) || winner.pin === this.opts.getPin()) return;
    if (winner.host === selfHost && winner.hostname === selfName) return;
    this.opts.adoptPin(winner.pin);
  }

  private ensureOutbound(host: string): void {
    if (this.closed || this.ownHosts.has(host)) return;
    if (this.outbound.has(host) || this.connecting.has(host)) return;
    this.connecting.add(host);
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${host}:${REMOTE_PORT}/ws`);
    } catch {
      this.connecting.delete(host);
      return;
    }
    ws.on("open", () => {
      this.connecting.delete(host);
      if (this.closed) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      this.outbound.set(host, ws);
      const hello: RemoteClientMsg = {
        type: "peer_hello",
        pin: this.opts.getPin(),
        venueId: this.opts.getVenueId(),
        yeoksamRole: this.opts.getYeoksamRole(),
        hostname: this.opts.hostname() || osHostname() || "pc",
      };
      ws.send(JSON.stringify(hello));
      if (!this.isShopFollower()) {
        const local = this.opts.getOwnedSnapshot();
        const snap: RemoteClientMsg = {
          type: "peer_snapshot",
          hostname: local.hostname,
          snapshot: local.snapshot,
          timers: local.timers,
          serverNow: local.serverNow,
          yeoksamRole: this.opts.getYeoksamRole(),
          timerTheme: this.opts.getShopTimerTheme() ?? undefined,
        };
        ws.send(JSON.stringify(snap));
      }
    });
    ws.on("message", (raw) => {
      let msg: RemoteServerMsg;
      try {
        msg = JSON.parse(String(raw)) as RemoteServerMsg;
      } catch {
        return;
      }
      if (msg.type === "hello_fail") {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      if (msg.type !== "snapshot") return;
      this.rememberPeer(host, {
        host,
        hostname: msg.hostname || host,
        snapshot: msg.snapshot ?? EMPTY_SNAP,
        timers: msg.timers ?? [],
        serverNow: typeof msg.serverNow === "number" ? msg.serverNow : Date.now(),
        yeoksamRole: msg.yeoksamRole,
        timerTheme: msg.timerTheme,
      });
    });
    ws.on("close", () => {
      this.connecting.delete(host);
      this.outbound.delete(host);
      if (!this.inbound.has(host)) this.forgetHost(host);
    });
    ws.on("error", () => {
      /* close handler cleans up */
    });
  }
}
