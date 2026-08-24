import { contextBridge, ipcRenderer, shell } from "electron";
import type { BlindStructureOption, TableTimerState, TimerAction } from "@mnf/timer/types";
import type { AppConfig, AppSnapshot, DisplayInfo, GameSession, UiThemeId } from "../shared/types";

export type ControlApi = {
  // 디스플레이/설정
  getDisplays: () => Promise<DisplayInfo[]>;
  getConfig: () => Promise<AppConfig | null>;
  saveConfig: (config: AppConfig) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSetupRequired: (cb: () => void) => () => void;
  getTheme: () => Promise<UiThemeId>;
  setTheme: (theme: UiThemeId) => Promise<{ ok: true; theme: UiThemeId } | { ok: false; error: string }>;
  onThemeUpdate: (cb: (theme: UiThemeId) => void) => () => void;
  getRemoteInfo: () => Promise<import("../shared/remote").RemotePairingInfo>;
  refreshRemoteQr: () => Promise<import("../shared/remote").RemotePairingInfo>;
  // 블라인드
  listBlinds: () => Promise<BlindStructureOption[]>;
  listLocalBlinds: () => Promise<BlindStructureOption[]>;
  // 스냅샷
  getSnapshot: () => Promise<AppSnapshot>;
  onSnapshot: (cb: (snap: AppSnapshot) => void) => () => void;
  onTimerUpdate: (cb: (timers: TableTimerState[]) => void) => () => void;
  // 게임
  createGame: (structure: BlindStructureOption) => Promise<{ ok: true; session: GameSession } | { ok: false; error: string }>;
  deleteGame: (gameId: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  // 테이블/모니터 연결
  assignTable: (tableSlot: number, gameId: number | null) => Promise<{ ok: true } | { ok: false; error: string }>;
  assignMonitor: (monitorSlot: number, gameId: number | null) => Promise<{ ok: true } | { ok: false; error: string }>;
  // 타이머
  timerCommand: (gameId: number, action: TimerAction, options?: { minutes?: number; ms?: number; sec?: number }) => Promise<{ ok: true; state: TableTimerState } | { ok: false; error: string }>;
  // 세션 카운터
  updateCounters: (gameId: number, patch: { players?: number; entries?: number; rebuys?: number[]; addon?: number; bonusChip?: number; leftNotice?: import("../shared/types").LeftNotice | null }) => Promise<{ ok: true } | { ok: false; error: string }>;
  openExternal: (url: string) => void;
  quit: () => void;
  // 업데이터
  checkUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdaterStatus: (cb: (info: { status: string; version?: string; percent?: number; message?: string }) => void) => () => void;
};

const api: ControlApi = {
  getDisplays: () => ipcRenderer.invoke("displays:get"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  onSetupRequired: (cb) => {
    const h = () => cb();
    ipcRenderer.on("config:setup-required", h);
    return () => ipcRenderer.removeListener("config:setup-required", h);
  },
  getTheme: () => ipcRenderer.invoke("theme:get"),
  setTheme: (theme) => ipcRenderer.invoke("theme:set", theme),
  onThemeUpdate: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, theme: UiThemeId) => cb(theme);
    ipcRenderer.on("theme:update", h);
    return () => ipcRenderer.removeListener("theme:update", h);
  },
  getRemoteInfo: () => ipcRenderer.invoke("remote:info"),
  refreshRemoteQr: () => ipcRenderer.invoke("remote:refreshQr"),
  listBlinds: () => ipcRenderer.invoke("blinds:list"),
  listLocalBlinds: () => ipcRenderer.invoke("blinds:local:list"),
  getSnapshot: () => ipcRenderer.invoke("app:snapshot"),
  onSnapshot: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, snap: AppSnapshot) => cb(snap);
    ipcRenderer.on("app:snapshot:push", h);
    return () => ipcRenderer.removeListener("app:snapshot:push", h);
  },
  onTimerUpdate: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, timers: TableTimerState[]) => cb(timers);
    ipcRenderer.on("timer:snapshot", h);
    return () => ipcRenderer.removeListener("timer:snapshot", h);
  },
  createGame: (structure) => ipcRenderer.invoke("game:create", structure),
  deleteGame: (gameId) => ipcRenderer.invoke("game:delete", gameId),
  assignTable: (tableSlot, gameId) => ipcRenderer.invoke("table:assign", { tableSlot, gameId }),
  assignMonitor: (monitorSlot, gameId) => ipcRenderer.invoke("monitor:assign", { monitorSlot, gameId }),
  timerCommand: (gameId, action, options) =>
    ipcRenderer.invoke("timer:command", { gameId, action, ...options }),
  updateCounters: (gameId, patch) => {
    const payload: Record<string, unknown> = { gameId };
    if (patch.players !== undefined) payload.players = patch.players;
    if (patch.entries !== undefined) payload.entries = patch.entries;
    if (patch.rebuys !== undefined) payload.rebuys = patch.rebuys;
    if (patch.addon !== undefined) payload.addon = patch.addon;
    if (patch.bonusChip !== undefined) payload.bonusChip = patch.bonusChip;
    if (patch.leftNotice !== undefined) {
      payload.leftNotice =
        patch.leftNotice === null ? null : { html: String(patch.leftNotice.html ?? "") };
    }
    return ipcRenderer.invoke("session:counters", payload);
  },
  openExternal: (url) => void shell.openExternal(url),
  quit: () => void ipcRenderer.invoke("app:quit"),
  checkUpdate: () => ipcRenderer.invoke("updater:check"),
  downloadUpdate: () => ipcRenderer.invoke("updater:download"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  onUpdaterStatus: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, info: Parameters<typeof cb>[0]) => cb(info);
    ipcRenderer.on("updater:status", h);
    return () => ipcRenderer.removeListener("updater:status", h);
  },
};

contextBridge.exposeInMainWorld("controlApi", api);

declare global {
  interface Window {
    controlApi: ControlApi;
  }
}
