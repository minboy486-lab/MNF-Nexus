import { contextBridge, ipcRenderer, shell } from "electron";
import type { BlindStructureOption, TableTimerState, TimerAction } from "@mnf/timer/types";
import type { AppConfig, AppSnapshot, DisplayInfo, GameSession } from "../shared/types";

type IpcResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : { ok: true } & T | { ok: false; error: string };

export type ControlApi = {
  // 디스플레이/설정
  getDisplays: () => Promise<DisplayInfo[]>;
  getConfig: () => Promise<AppConfig | null>;
  saveConfig: (config: AppConfig) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSetupRequired: (cb: () => void) => () => void;
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
  updateCounters: (gameId: number, patch: { players?: number; entries?: number; rebuys?: number[]; addon?: number; bonusChip?: number }) => Promise<{ ok: true } | { ok: false; error: string }>;
  openExternal: (url: string) => void;
  quit: () => void;
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
  updateCounters: (gameId, patch) =>
    ipcRenderer.invoke("session:counters", { gameId, ...patch }),
  openExternal: (url) => void shell.openExternal(url),
  quit: () => void ipcRenderer.invoke("app:quit"),
};

contextBridge.exposeInMainWorld("controlApi", api);

declare global {
  interface Window {
    controlApi: ControlApi;
  }
}
