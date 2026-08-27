import { contextBridge, ipcRenderer, shell } from "electron";
import type { BlindStructureOption, TableTimerState, TimerAction } from "@mnf/timer/types";
import type { AppConfig, AppSnapshot, DisplayInfo, GameSession, ThemeSurface, UiThemeId } from "../shared/types";
import type { TimerLook, SavedTimerTheme } from "../shared/timerLook";
import type { ControlLook, SavedControlTheme } from "../shared/controlLook";
import type { LanDiscoveredGame, LanViewState } from "../shared/lanView";

export type ControlApi = {
  // 디스플레이/설정
  getDisplays: () => Promise<DisplayInfo[]>;
  getConfig: () => Promise<AppConfig | null>;
  saveConfig: (config: AppConfig) => Promise<{ ok: true } | { ok: false; error: string }>;
  setVenue: (opts: { venueId: string; pin: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSetupRequired: (cb: () => void) => () => void;
  getTheme: () => Promise<UiThemeId>;
  setTheme: (
    surface: ThemeSurface,
    theme: UiThemeId,
  ) => Promise<{ ok: true; surface: ThemeSurface; theme: UiThemeId } | { ok: false; error: string }>;
  onThemesUpdate: (cb: (themes: {
    controlTheme: UiThemeId;
    timerTheme: UiThemeId;
    activeTimerThemeId?: string;
    savedTimerThemes?: SavedTimerTheme[];
    activeControlThemeId?: string;
    savedControlThemes?: SavedControlTheme[];
  }) => void) => () => void;
  selectTimerTheme: (
    id: string,
  ) => Promise<
    | {
        ok: true;
        timerTheme?: UiThemeId;
        activeTimerThemeId?: string;
        look: TimerLook | null;
        savedTimerThemes: SavedTimerTheme[];
      }
    | { ok: false; error: string }
  >;
  saveTimerTheme: (opts: {
    name: string;
    look: TimerLook;
    id?: string;
  }) => Promise<
    | {
        ok: true;
        saved: SavedTimerTheme;
        timerTheme?: UiThemeId;
        activeTimerThemeId?: string;
        look: TimerLook | null;
        savedTimerThemes: SavedTimerTheme[];
      }
    | { ok: false; error: string }
  >;
  deleteTimerTheme: (
    id: string,
  ) => Promise<
    | {
        ok: true;
        timerTheme?: UiThemeId;
        activeTimerThemeId?: string;
        look: TimerLook | null;
        savedTimerThemes: SavedTimerTheme[];
      }
    | { ok: false; error: string }
  >;
  selectControlTheme: (
    id: string,
  ) => Promise<
    | {
        ok: true;
        controlTheme?: UiThemeId;
        activeControlThemeId?: string;
        look: ControlLook | null;
        savedControlThemes: SavedControlTheme[];
      }
    | { ok: false; error: string }
  >;
  saveControlTheme: (opts: {
    name: string;
    look: ControlLook;
    id?: string;
  }) => Promise<
    | {
        ok: true;
        saved: SavedControlTheme;
        controlTheme?: UiThemeId;
        activeControlThemeId?: string;
        look: ControlLook | null;
        savedControlThemes: SavedControlTheme[];
      }
    | { ok: false; error: string }
  >;
  deleteControlTheme: (
    id: string,
  ) => Promise<
    | {
        ok: true;
        controlTheme?: UiThemeId;
        activeControlThemeId?: string;
        look: ControlLook | null;
        savedControlThemes: SavedControlTheme[];
      }
    | { ok: false; error: string }
  >;
  getSoundVolume: () => Promise<number>;
  setSoundVolume: (volume: number) => Promise<{ ok: true; volume: number }>;
  onSoundVolumeUpdate: (cb: (volume: number) => void) => () => void;
  getTimerLook: () => Promise<TimerLook | null>;
  setTimerLook: (look: TimerLook | null) => Promise<{ ok: true; look: TimerLook | null } | { ok: false; error: string }>;
  onTimerLookUpdate: (cb: (look: TimerLook | null) => void) => () => void;
  getControlLook: () => Promise<ControlLook | null>;
  setControlLook: (look: ControlLook | null) => Promise<{ ok: true; look: ControlLook | null } | { ok: false; error: string }>;
  onControlLookUpdate: (cb: (look: ControlLook | null) => void) => () => void;
  getRemoteInfo: () => Promise<import("../shared/remote").RemotePairingInfo>;
  refreshRemoteQr: () => Promise<import("../shared/remote").RemotePairingInfo>;
  // 블라인드
  listBlinds: () => Promise<BlindStructureOption[]>;
  listLocalBlinds: () => Promise<BlindStructureOption[]>;
  // 스냅샷
  getSnapshot: () => Promise<AppSnapshot>;
  getTimers: () => Promise<TableTimerState[]>;
  onSnapshot: (cb: (snap: AppSnapshot) => void) => () => void;
  onTimerUpdate: (cb: (timers: TableTimerState[]) => void) => () => void;
  onTimerPatch: (cb: (timer: TableTimerState) => void) => () => void;
  // 게임
  createGame: (structure: BlindStructureOption) => Promise<{ ok: true; session: GameSession } | { ok: false; error: string }>;
  deleteGame: (gameId: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  // 테이블/모니터 연결
  assignTable: (tableSlot: number, gameId: number | null) => Promise<{ ok: true } | { ok: false; error: string }>;
  assignMonitor: (monitorSlot: number, gameId: number | null) => Promise<{ ok: true } | { ok: false; error: string }>;
  assignAllMonitors: (gameId: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  discoverLanGames: () => Promise<LanDiscoveredGame[]>;
  startLanView: (opts: {
    host: string;
    hostname?: string;
    gameId: number;
    structureName: string;
    theme?: string;
    soundVolume?: number;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  stopLanView: () => Promise<{ ok: true }>;
  onLanViewState: (cb: (state: LanViewState | null) => void) => () => void;
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
  setVenue: (opts) => ipcRenderer.invoke("venue:set", opts),
  onSetupRequired: (cb) => {
    const h = () => cb();
    ipcRenderer.on("config:setup-required", h);
    return () => ipcRenderer.removeListener("config:setup-required", h);
  },
  getTheme: () => ipcRenderer.invoke("theme:get"),
  setTheme: (surface, theme) => ipcRenderer.invoke("theme:set", { surface, theme }),
  onThemesUpdate: (cb) => {
    const h = (
      _e: Electron.IpcRendererEvent,
      themes: {
        controlTheme: UiThemeId;
        timerTheme: UiThemeId;
        activeTimerThemeId?: string;
        savedTimerThemes?: SavedTimerTheme[];
        activeControlThemeId?: string;
        savedControlThemes?: SavedControlTheme[];
      },
    ) => cb(themes);
    ipcRenderer.on("themes:update", h);
    return () => ipcRenderer.removeListener("themes:update", h);
  },
  selectTimerTheme: (id) => ipcRenderer.invoke("timerTheme:select", id),
  saveTimerTheme: (opts) => ipcRenderer.invoke("timerTheme:save", opts),
  deleteTimerTheme: (id) => ipcRenderer.invoke("timerTheme:delete", id),
  selectControlTheme: (id) => ipcRenderer.invoke("controlTheme:select", id),
  saveControlTheme: (opts) => ipcRenderer.invoke("controlTheme:save", opts),
  deleteControlTheme: (id) => ipcRenderer.invoke("controlTheme:delete", id),
  getSoundVolume: () => ipcRenderer.invoke("soundVolume:get"),
  setSoundVolume: (volume) => ipcRenderer.invoke("soundVolume:set", volume),
  onSoundVolumeUpdate: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, volume: number) => cb(volume);
    ipcRenderer.on("soundVolume:update", h);
    return () => ipcRenderer.removeListener("soundVolume:update", h);
  },
  getTimerLook: () => ipcRenderer.invoke("timerLook:get"),
  setTimerLook: (look) => ipcRenderer.invoke("timerLook:set", look),
  onTimerLookUpdate: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, look: TimerLook | null) => cb(look);
    ipcRenderer.on("timerLook:update", h);
    return () => ipcRenderer.removeListener("timerLook:update", h);
  },
  getControlLook: () => ipcRenderer.invoke("controlLook:get"),
  setControlLook: (look) => ipcRenderer.invoke("controlLook:set", look),
  onControlLookUpdate: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, look: ControlLook | null) => cb(look);
    ipcRenderer.on("controlLook:update", h);
    return () => ipcRenderer.removeListener("controlLook:update", h);
  },
  getRemoteInfo: () => ipcRenderer.invoke("remote:info"),
  refreshRemoteQr: () => ipcRenderer.invoke("remote:refreshQr"),
  listBlinds: () => ipcRenderer.invoke("blinds:list"),
  listLocalBlinds: () => ipcRenderer.invoke("blinds:local:list"),
  getSnapshot: () => ipcRenderer.invoke("app:snapshot"),
  getTimers: () => ipcRenderer.invoke("timer:getAll"),
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
  onTimerPatch: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, timer: TableTimerState) => cb(timer);
    ipcRenderer.on("timer:update", h);
    return () => ipcRenderer.removeListener("timer:update", h);
  },
  createGame: (structure) => ipcRenderer.invoke("game:create", structure),
  deleteGame: (gameId) => ipcRenderer.invoke("game:delete", gameId),
  assignTable: (tableSlot, gameId) => ipcRenderer.invoke("table:assign", { tableSlot, gameId }),
  assignMonitor: (monitorSlot, gameId) => ipcRenderer.invoke("monitor:assign", { monitorSlot, gameId }),
  assignAllMonitors: (gameId) => ipcRenderer.invoke("monitor:assign-all", gameId),
  discoverLanGames: () => ipcRenderer.invoke("lan:discover"),
  startLanView: (opts) => ipcRenderer.invoke("lan:view-start", opts),
  stopLanView: () => ipcRenderer.invoke("lan:view-stop"),
  onLanViewState: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, state: LanViewState | null) => cb(state);
    ipcRenderer.on("lan:view-state", h);
    return () => ipcRenderer.removeListener("lan:view-state", h);
  },
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
