import WebSocket from "ws";
import { createInitialTimerState } from "@mnf/timer/engine";
import type { TableTimerState } from "@mnf/timer/types";
import { REMOTE_PORT, type RemoteClientMsg, type RemoteServerMsg } from "../../shared/remote";
import type { GameSession } from "../../shared/types";
import type { LanViewState } from "../../shared/lanView";
import type { WindowManager } from "../windows/windowManager";

type Listener = (state: LanViewState | null) => void;

export class LanViewClient {
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = true;
  private host = "";
  private hostname = "";
  private gameId = 0;
  private structureName = "";
  private theme?: string;
  private soundVolume?: number;
  private listeners = new Set<Listener>();

  constructor(private wm: WindowManager) {}

  onState(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(state: LanViewState | null): void {
    for (const fn of this.listeners) fn(state);
  }

  isActive(): boolean {
    return !this.closed;
  }

  async start(opts: {
    host: string;
    hostname?: string;
    gameId: number;
    structureName: string;
    theme?: string;
    soundVolume?: number;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    this.stop();
    this.closed = false;
    this.host = opts.host;
    this.hostname = opts.hostname || opts.host;
    this.gameId = opts.gameId;
    this.structureName = opts.structureName;
    this.theme = opts.theme;
    this.soundVolume = opts.soundVolume;
    this.connect();
    return { ok: true };
  }

  stop(): void {
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.emit(null);
    this.wm.restoreLocalDisplays();
  }

  private connect(): void {
    if (this.closed) return;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    const ws = new WebSocket(`ws://${this.host}:${REMOTE_PORT}/ws`);
    this.ws = ws;
    ws.on("open", () => {
      const msg: RemoteClientMsg = { type: "view", gameId: this.gameId };
      ws.send(JSON.stringify(msg));
    });
    ws.on("message", (raw) => {
      let msg: RemoteServerMsg;
      try {
        msg = JSON.parse(String(raw)) as RemoteServerMsg;
      } catch {
        return;
      }
      if (msg.type === "view_ok") {
        this.theme = msg.theme;
        this.soundVolume = msg.soundVolume;
        this.pushAppearance();
        return;
      }
      if (msg.type === "snapshot") {
        const timer = msg.timers.find((t) => t.tableId === this.gameId) ?? null;
        const session = msg.snapshot.sessions.find((s) => s.gameId === this.gameId) ?? null;
        this.apply(timer, session, msg.serverNow);
        return;
      }
      if (msg.type === "error") {
        this.emit({
          host: this.host,
          hostname: this.hostname,
          gameId: this.gameId,
          structureName: this.structureName,
          timer: null,
          session: null,
          theme: this.theme,
          soundVolume: this.soundVolume,
        });
      }
    });
    ws.on("close", () => {
      if (this.closed) return;
      this.timer = setTimeout(() => this.connect(), 1200);
    });
    ws.on("error", () => {
      /* close handler reconnects */
    });
  }

  private pushAppearance(): void {
    if (this.theme) this.wm.broadcastThemeToDisplays(this.theme);
    if (typeof this.soundVolume === "number") this.wm.broadcastVolumeToDisplays(this.soundVolume);
  }

  private apply(timer: TableTimerState | null, session: GameSession | null, serverNow?: number): void {
    const state = timer ?? createInitialTimerState(this.gameId);
    this.wm.broadcastToAllDisplays(state, session);
    this.emit({
      host: this.host,
      hostname: this.hostname,
      gameId: this.gameId,
      structureName: session?.structureName ?? this.structureName,
      timer,
      session,
      theme: this.theme,
      soundVolume: this.soundVolume,
      serverNow,
    });
  }
}
