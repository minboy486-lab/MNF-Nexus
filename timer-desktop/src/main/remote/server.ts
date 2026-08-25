import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { WebSocketServer, type WebSocket } from "ws";
import {
  isRemoteCounterOp,
  isRemoteTimerAction,
  LAN_CLUSTER_PATH,
  PUNCH_TOKEN_TTL_MS,
  REMOTE_PORT,
  type RemoteClientMsg,
  type RemotePairingInfo,
  type RemotePeerSnapshot,
  type RemoteServerMsg,
  type RemoteStaffState,
} from "../../shared/remote";
import type { TimerHub } from "../timer/timerHub";
import { clockInStaff, clockOutStaff, claimStaffByLoginId, loginStaff, rejoinStaffByLoginId, refreshStaffClock, type StaffAuthOk } from "../supabase/staffAuth";
import { getSupabase } from "../supabase/client";
import { hostname } from "node:os";
import { getDisplayRemainingMs } from "@mnf/timer/engine";
import { listLanIPv4 } from "./lan";
import { loadRemoteAuth, saveRemoteAuth } from "./authStore";
import type { LanHostGames } from "../../shared/lanView";
import { LanCluster, normalizeRemoteIp } from "./lanCluster";
import type { AppSnapshot } from "../../shared/types";
import type { TableTimerState } from "@mnf/timer/types";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

type RemoteSession = {
  token: string;
  staff: StaffAuthOk;
  canControl: boolean;
};

type SockState = {
  pinOk: boolean;
  session: RemoteSession | null;
  viewOnly: boolean;
  viewGameId: number | null;
  peer: boolean;
  remoteHost: string;
};

function newToken(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}

function sendJson(ws: WebSocket, msg: RemoteServerMsg): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function parseMsg(raw: string): RemoteClientMsg | null {
  try {
    const v = JSON.parse(raw) as RemoteClientMsg;
    if (!v || typeof v !== "object" || typeof v.type !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

function toStaffState(session: RemoteSession): RemoteStaffState {
  return {
    name: session.staff.name,
    loginId: session.staff.loginId,
    checkedIn: session.staff.checkedIn,
    canControl: session.canControl,
    checkedInAt: session.staff.checkedInAt,
  };
}

export class RemoteServer {
  pin = "";
  readonly port = REMOTE_PORT;
  private http: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, SockState>();
  private sessions = new Map<string, RemoteSession>();
  private unsubHub: (() => void) | null = null;
  private infoCache: RemotePairingInfo | null = null;
  private hub: TimerHub | null = null;
  private punchToken = newToken();
  private punchExpiresAt = 0;
  private staffAuthEnabled = false;
  private getThemeId: () => string = () => "black-pink";
  private getVolume: () => number = () => 100;
  private cluster: LanCluster | null = null;

  setAppearance(getTheme: () => string, getVolume: () => number): void {
    this.getThemeId = getTheme;
    this.getVolume = getVolume;
  }

  async start(hub: TimerHub): Promise<void> {
    this.hub = hub;
    this.staffAuthEnabled = !!getSupabase();
    const auth = loadRemoteAuth();
    this.pin = auth.pin;
    this.sessions.clear();
    for (const s of auth.sessions) this.sessions.set(s.token, s);
    this.persistAuth();
    this.unsubHub = hub.onRemotePush(() => this.onLocalHubChange());
    this.cluster = new LanCluster({
      getPin: () => this.pin,
      adoptPin: (pin) => this.adoptPin(pin),
      hostname: () => hostname() || "pc",
      getLocalSnapshot: () => this.localSnapshotPayload(),
      onPeersChange: () => this.broadcastToOperators(),
    });
    this.rotatePunchToken();

    const wss = new WebSocketServer({ noServer: true });
    this.wss = wss;
    wss.on("connection", (ws, req) => this.onSocket(ws, req));

    const http = createServer((req, res) => {
      void this.handleHttp(req, res);
    });
    this.http = http;
    http.on("upgrade", (req, socket, head) => {
      const path = (req.url ?? "/").split("?")[0];
      if (path !== "/ws") {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    });

    await new Promise<void>((resolve, reject) => {
      http.once("error", reject);
      http.listen(this.port, "0.0.0.0", () => resolve());
    });
    this.infoCache = await this.buildInfo();
    this.cluster.start();
    console.log(`[remote] LAN http://0.0.0.0:${this.port} PIN ${this.pin}`);
  }

  stop(): void {
    this.cluster?.stop();
    this.cluster = null;
    this.unsubHub?.();
    this.unsubHub = null;
    for (const ws of this.clients.keys()) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
    this.sessions.clear();
    this.wss?.close();
    this.wss = null;
    this.http?.close();
    this.http = null;
  }

  getInfo(): RemotePairingInfo {
    return (
      this.infoCache ?? {
        pin: this.pin,
        port: this.port,
        urls: [],
        qrDataUrl: null,
        punchToken: this.punchToken,
        expiresAt: this.punchExpiresAt,
      }
    );
  }

  async refreshPairing(): Promise<RemotePairingInfo> {
    this.rotatePunchToken();
    this.infoCache = await this.buildInfo();
    return this.infoCache;
  }

  private rotatePunchToken(): void {
    this.punchToken = newToken();
    this.punchExpiresAt = Date.now() + PUNCH_TOKEN_TTL_MS;
  }

  private async buildInfo(): Promise<RemotePairingInfo> {
    const ips = await listLanIPv4();
    const hosts = ips.length > 0 ? ips : ["127.0.0.1"];
    const urls = hosts.map(
      (ip) => `http://${ip}:${this.port}/remote/?pin=${this.pin}&tok=${this.punchToken}`,
    );
    return {
      pin: this.pin,
      port: this.port,
      urls,
      qrDataUrl: null,
      punchToken: this.punchToken,
      expiresAt: this.punchExpiresAt,
    };
  }

  private adoptPin(pin: string): void {
    if (!/^\d{4}$/.test(pin) || pin === this.pin) return;
    this.pin = pin;
    this.persistAuth();
    void this.buildInfo().then((info) => {
      this.infoCache = info;
    });
    console.log(`[remote] 매장 PIN 맞춤 ${this.pin}`);
  }

  private localSnapshotPayload(): {
    snapshot: AppSnapshot;
    timers: TableTimerState[];
    serverNow: number;
    hostname: string;
  } {
    const hub = this.hub;
    return {
      snapshot: hub?.getSnapshot() ?? { sessions: [], monitorAssignments: {}, tableAssignments: {} },
      timers: hub?.getAllTimers() ?? [],
      serverNow: Date.now(),
      hostname: hostname() || "pc",
    };
  }

  private localSnapshotMsg(): RemoteServerMsg {
    const local = this.localSnapshotPayload();
    return {
      type: "snapshot",
      snapshot: local.snapshot,
      timers: local.timers,
      serverNow: local.serverNow,
      hostname: local.hostname,
    };
  }

  private federatedSnapshotMsg(): RemoteServerMsg {
    const local = this.localSnapshotMsg();
    if (local.type !== "snapshot") return local;
    const peers: RemotePeerSnapshot[] = this.cluster?.peers() ?? [];
    return { ...local, peers };
  }

  private onLocalHubChange(): void {
    this.broadcastLocalToPeersAndViews();
    this.broadcastToOperators();
    this.cluster?.pushLocalSnapshot();
  }

  private broadcastLocalToPeersAndViews(): void {
    const msg = JSON.stringify(this.localSnapshotMsg());
    for (const [ws, st] of this.clients) {
      if (ws.readyState === ws.OPEN && (st.peer || st.viewOnly)) ws.send(msg);
    }
  }

  private broadcastToOperators(): void {
    const msg = JSON.stringify(this.federatedSnapshotMsg());
    for (const [ws, st] of this.clients) {
      if (ws.readyState === ws.OPEN && this.canOperate(st) && !st.peer && !st.viewOnly) ws.send(msg);
    }
  }

  private canOperate(state: SockState): boolean {
    if (!state.pinOk) return false;
    if (!this.staffAuthEnabled) return true;
    return !!state.session?.canControl;
  }

  private helloOk(): RemoteServerMsg {
    return { type: "hello_ok", staffAuth: this.staffAuthEnabled, serverNow: Date.now() };
  }

  private afterPin(ws: WebSocket, state: SockState): void {
    sendJson(ws, this.helloOk());
    if (this.canOperate(state)) sendJson(ws, this.federatedSnapshotMsg());
  }

  private persistAuth(): void {
    if (!this.pin) return;
    saveRemoteAuth({
      pin: this.pin,
      sessions: [...this.sessions.values()],
    });
  }

  private putSession(session: RemoteSession): void {
    for (const [token, existing] of this.sessions) {
      if (existing.staff.staffId === session.staff.staffId && token !== session.token) {
        this.sessions.delete(token);
      }
    }
    this.sessions.set(session.token, session);
    this.persistAuth();
  }

  private dropSession(token: string): void {
    this.sessions.delete(token);
    this.persistAuth();
  }

  private bindSession(ws: WebSocket, state: SockState, session: RemoteSession): void {
    state.session = session;
    this.sendStaff(ws, session);
    if (session.canControl) sendJson(ws, this.federatedSnapshotMsg());
  }

  private sendStaff(ws: WebSocket, session: RemoteSession): void {
    sendJson(ws, { type: "staff", staff: toStaffState(session), sessionToken: session.token });
  }

  private onSocket(ws: WebSocket, req: IncomingMessage): void {
    const state: SockState = {
      pinOk: false,
      session: null,
      viewOnly: false,
      viewGameId: null,
      peer: false,
      remoteHost: normalizeRemoteIp(req.socket.remoteAddress),
    };
    const q = new URL(req.url ?? "/", "http://localhost").searchParams.get("pin");
    if (q && q === this.pin) state.pinOk = true;

    this.clients.set(ws, state);
    if (state.pinOk) this.afterPin(ws, state);

    ws.on("message", (data) => {
      const msg = parseMsg(String(data));
      if (!msg) return;
      void this.handleMessage(ws, state, msg);
    });

    ws.on("close", () => {
      this.cluster?.dropSocket(ws);
      this.clients.delete(ws);
    });
  }

  private async handleMessage(ws: WebSocket, state: SockState, msg: RemoteClientMsg): Promise<void> {
    if (msg.type === "view") {
      const hub = this.hub;
      if (!hub || !Number.isInteger(msg.gameId) || msg.gameId < 1) {
        sendJson(ws, { type: "error", error: "유효하지 않은 게임입니다." });
        return;
      }
      if (!hub.getTimer(msg.gameId)) {
        sendJson(ws, { type: "error", error: "진행 중인 게임이 아닙니다." });
        return;
      }
      state.viewOnly = true;
      state.viewGameId = msg.gameId;
      sendJson(ws, {
        type: "view_ok",
        gameId: msg.gameId,
        theme: this.getThemeId(),
        soundVolume: this.getVolume(),
        serverNow: Date.now(),
      });
      sendJson(ws, this.localSnapshotMsg());
      return;
    }
    if (msg.type === "peer_hello") {
      if (msg.pin !== this.pin) {
        sendJson(ws, { type: "hello_fail", error: "PIN이 올바르지 않습니다." });
        ws.close();
        return;
      }
      state.pinOk = true;
      state.peer = true;
      this.cluster?.noteInbound(state.remoteHost, ws);
      sendJson(ws, this.localSnapshotMsg());
      return;
    }
    if (msg.type === "hello") {
      if (msg.pin !== this.pin) {
        sendJson(ws, { type: "hello_fail", error: "PIN이 올바르지 않습니다." });
        ws.close();
        return;
      }
      state.pinOk = true;
      this.afterPin(ws, state);
      return;
    }
    if (!state.pinOk) {
      sendJson(ws, { type: "hello_fail", error: "PIN이 필요합니다." });
      return;
    }

    if (msg.type === "claim") {
      if (!msg.token || msg.token !== this.punchToken || Date.now() > this.punchExpiresAt) {
        sendJson(ws, { type: "error", error: "QR이 만료되었거나 올바르지 않습니다. 컨트롤러 로고를 다시 눌러 주세요." });
        return;
      }
      const result = await claimStaffByLoginId(msg.loginId);
      if ("error" in result) {
        sendJson(ws, { type: "error", error: result.error });
        return;
      }
      const session: RemoteSession = { token: newToken(24), staff: result, canControl: true };
      this.putSession(session);
      this.bindSession(ws, state, session);
      return;
    }

    if (msg.type === "login") {
      const result = await loginStaff(msg.loginId, msg.password);
      if ("error" in result) {
        sendJson(ws, { type: "error", error: result.error });
        return;
      }
      const session: RemoteSession = { token: newToken(24), staff: result, canControl: false };
      this.putSession(session);
      this.bindSession(ws, state, session);
      return;
    }

    if (msg.type === "resume") {
      const session = this.sessions.get(msg.sessionToken);
      if (!session) {
        sendJson(ws, { type: "error", error: "세션이 만료되었습니다. 다시 연결합니다." });
        return;
      }
      const staff = await refreshStaffClock(session.staff);
      session.staff = staff;
      session.canControl = staff.checkedIn;
      this.putSession(session);
      this.bindSession(ws, state, session);
      return;
    }

    if (msg.type === "rejoin") {
      const result = await rejoinStaffByLoginId(msg.loginId);
      if ("error" in result) {
        sendJson(ws, { type: "error", error: result.error });
        return;
      }
      const session: RemoteSession = { token: newToken(24), staff: result, canControl: true };
      this.putSession(session);
      this.bindSession(ws, state, session);
      return;
    }

    if (msg.type === "logout") {
      if (state.session) this.dropSession(state.session.token);
      state.session = null;
      return;
    }

    if (msg.type === "punch") {
      if (!state.session) {
        sendJson(ws, { type: "error", error: "먼저 직원 계정으로 로그인하세요." });
        return;
      }
      if (!msg.token || msg.token !== this.punchToken || Date.now() > this.punchExpiresAt) {
        sendJson(ws, { type: "error", error: "QR이 만료되었거나 올바르지 않습니다. 컨트롤러 로고를 다시 눌러 주세요." });
        return;
      }
      const punched = await clockInStaff(state.session.staff.staffId);
      if ("error" in punched) {
        sendJson(ws, { type: "error", error: punched.error });
        return;
      }
      state.session.staff.checkedIn = true;
      state.session.staff.checkedInAt = punched.checkedInAt;
      state.session.canControl = true;
      this.putSession(state.session);
      this.bindSession(ws, state, state.session);
      return;
    }

    if (msg.type === "checkout") {
      if (!state.session) {
        sendJson(ws, { type: "error", error: "로그인되어 있지 않습니다." });
        return;
      }
      const out = await clockOutStaff(state.session.staff.staffId);
      if ("error" in out) {
        sendJson(ws, { type: "error", error: out.error });
        return;
      }
      state.session.staff.checkedIn = false;
      state.session.staff.checkedInAt = null;
      state.session.canControl = false;
      this.dropSession(state.session.token);
      this.sendStaff(ws, state.session);
      state.session = null;
      return;
    }

    if (state.peer) {
      this.handlePeerMessage(ws, state, msg);
      return;
    }

    this.handleCommand(ws, state, msg);
  }

  private handlePeerMessage(ws: WebSocket, state: SockState, msg: RemoteClientMsg): void {
    const hub = this.hub;
    if (!hub) return;

    if (msg.type === "peer_snapshot") {
      this.cluster?.rememberPeer(state.remoteHost, {
        host: state.remoteHost,
        hostname: msg.hostname || state.remoteHost,
        snapshot: msg.snapshot,
        timers: msg.timers,
        serverNow: typeof msg.serverNow === "number" ? msg.serverNow : Date.now(),
      });
      return;
    }

    if (msg.type === "peer_command") {
      if (!Number.isInteger(msg.gameId) || msg.gameId < 1 || !isRemoteTimerAction(msg.action)) {
        sendJson(ws, { type: "error", error: "허용되지 않은 명령입니다." });
        return;
      }
      const result = hub.dispatch(msg.gameId, msg.action, {
        sec: typeof msg.sec === "number" ? msg.sec : undefined,
      });
      if (!result) sendJson(ws, { type: "error", error: "게임을 찾을 수 없습니다." });
      return;
    }

    if (msg.type === "peer_counters") {
      if (!Number.isInteger(msg.gameId) || msg.gameId < 1 || !isRemoteCounterOp(msg.op)) {
        sendJson(ws, { type: "error", error: "잘못된 카운터 명령입니다." });
        return;
      }
      const ok = hub.applyRemoteCounter(msg.gameId, msg.op, msg.rebuyIndex);
      if (!ok) sendJson(ws, { type: "error", error: "카운터를 바꿀 수 없습니다." });
      return;
    }

    if (msg.type === "peer_deleteGame") {
      if (!Number.isInteger(msg.gameId) || msg.gameId < 1) {
        sendJson(ws, { type: "error", error: "유효하지 않은 게임입니다." });
        return;
      }
      hub.deleteGame(msg.gameId);
    }
  }

  private handleCommand(ws: WebSocket, state: SockState, msg: RemoteClientMsg): void {
    const hub = this.hub;
    if (!hub) return;
    if (!this.canOperate(state)) {
      sendJson(ws, { type: "error", error: this.staffAuthEnabled ? "출근 연결이 필요합니다." : "PIN이 필요합니다." });
      return;
    }

    if (msg.type === "command" || msg.type === "counters" || msg.type === "deleteGame") {
      const target = typeof msg.host === "string" ? msg.host : "";
      if (target && this.cluster && !this.cluster.isOwnHost(target)) {
        const forwarded =
          msg.type === "command"
            ? this.cluster.forward(target, {
                type: "peer_command",
                gameId: msg.gameId,
                action: msg.action,
                sec: msg.sec,
              })
            : msg.type === "counters"
              ? this.cluster.forward(target, {
                  type: "peer_counters",
                  gameId: msg.gameId,
                  op: msg.op,
                  rebuyIndex: msg.rebuyIndex,
                })
              : this.cluster.forward(target, { type: "peer_deleteGame", gameId: msg.gameId });
        if (!forwarded) sendJson(ws, { type: "error", error: "다른 컴퓨터의 게임에 연결할 수 없습니다." });
        return;
      }
    }

    if (msg.type === "command") {
      if (!Number.isInteger(msg.gameId) || msg.gameId < 1) {
        sendJson(ws, { type: "error", error: "유효하지 않은 게임입니다." });
        return;
      }
      if (!isRemoteTimerAction(msg.action)) {
        sendJson(ws, { type: "error", error: "허용되지 않은 명령입니다." });
        return;
      }
      const result = hub.dispatch(msg.gameId, msg.action, {
        sec: typeof msg.sec === "number" ? msg.sec : undefined,
      });
      if (!result) sendJson(ws, { type: "error", error: "게임을 찾을 수 없습니다." });
      return;
    }

    if (msg.type === "counters") {
      if (!Number.isInteger(msg.gameId) || msg.gameId < 1 || !isRemoteCounterOp(msg.op)) {
        sendJson(ws, { type: "error", error: "잘못된 카운터 명령입니다." });
        return;
      }
      const ok = hub.applyRemoteCounter(msg.gameId, msg.op, msg.rebuyIndex);
      if (!ok) sendJson(ws, { type: "error", error: "카운터를 바꿀 수 없습니다." });
      return;
    }

    if (msg.type === "deleteGame") {
      if (!Number.isInteger(msg.gameId) || msg.gameId < 1) {
        sendJson(ws, { type: "error", error: "유효하지 않은 게임입니다." });
        return;
      }
      hub.deleteGame(msg.gameId);
    }
  }

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const host = req.headers.host ?? `127.0.0.1:${this.port}`;
      const url = new URL(req.url ?? "/", `http://${host}`);
      if (url.pathname === "/lan/cluster" || url.pathname === LAN_CLUSTER_PATH) {
        this.serveLanCluster(res);
        return;
      }
      if (url.pathname === "/lan/games") {
        this.serveLanGames(res);
        return;
      }
      if (url.pathname === "/manifest.webmanifest") {
        this.serveManifest(res);
        return;
      }
      const vite = process.env.ELECTRON_RENDERER_URL;
      if (vite) {
        await this.proxyVite(req, res, url, vite);
        return;
      }
      await this.serveStatic(res, url.pathname);
    } catch (e) {
      console.warn("[remote] http 오류", e);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("error");
      }
    }
  }

  private serveLanCluster(res: ServerResponse): void {
    const body = {
      ok: true,
      hostname: hostname() || "pc",
      pin: this.pin,
    };
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(body));
  }

  private serveLanGames(res: ServerResponse): void {
    const hub = this.hub;
    const snap = hub?.getSnapshot();
    const timers = hub?.getAllTimers() ?? [];
    const games = (snap?.sessions ?? []).map((session) => {
      const timer = timers.find((t) => t.tableId === session.gameId);
      return {
        gameId: session.gameId,
        structureName: session.structureName,
        status: timer?.status ?? "stopped",
        blindLevel: timer?.blindLevel ?? 1,
        smallBlind: timer?.smallBlind ?? 0,
        bigBlind: timer?.bigBlind ?? 0,
        remainingMs: timer ? getDisplayRemainingMs(timer) : 0,
      };
    });
    const body: LanHostGames = {
      ok: true,
      host: "",
      hostname: hostname(),
      theme: this.getThemeId(),
      soundVolume: this.getVolume(),
      games,
    };
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(body));
  }

  private serveManifest(res: ServerResponse): void {
    const body = JSON.stringify({
      name: "MNF HOLDEM",
      short_name: "MNF HOLDEM",
      start_url: "/remote/?source=pwa",
      display: "standalone",
      background_color: "#0d0b12",
      theme_color: "#0d0b12",
      icons: [
        { src: "/remote/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/remote/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    });
    res.writeHead(200, { "Content-Type": "application/manifest+json; charset=utf-8" });
    res.end(body);
  }

  private remoteIndexPath(pathname: string): string {
    if (
      pathname === "/" ||
      pathname === "/index.html" ||
      pathname === "/remote" ||
      pathname === "/remote/"
    ) {
      return "/remote/index.html";
    }
    return pathname;
  }

  private async proxyVite(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    vite: string,
  ): Promise<void> {
    const path = this.remoteIndexPath(url.pathname);
    const target = `${vite.replace(/\/$/, "")}${path}${url.search}`;
    const headers: Record<string, string> = {};
    const accept = req.headers.accept;
    if (typeof accept === "string") headers.Accept = accept;
    const r = await fetch(target, { headers });
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get("content-type") ?? guessMime(path);
    res.writeHead(r.status, { "Content-Type": type });
    res.end(buf);
  }

  private async serveStatic(res: ServerResponse, pathname: string): Promise<void> {
    const root = resolve(join(__dirname, "../renderer"));
    let rel = this.remoteIndexPath(pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const decoded = decodeURIComponent(rel);
    const full = resolve(root, `.${decoded}`);
    if (!full.startsWith(root + sep) && full !== root) {
      res.statusCode = 403;
      res.end("forbidden");
      return;
    }
    let file = full;
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": guessMime(file) });
    await pipeline(createReadStream(file), res);
  }
}

function guessMime(file: string): string {
  return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
}
