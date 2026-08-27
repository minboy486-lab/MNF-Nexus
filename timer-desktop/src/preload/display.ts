import { contextBridge, ipcRenderer } from "electron";
import type { TableTimerState } from "@mnf/timer/types";
import type { GameSession, UiThemeId } from "../shared/types";
import type { TimerLook } from "../shared/timerLook";

function readMonitorSlot(): number {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = Number(params.get("monitor") ?? params.get("game"));
  if (Number.isInteger(fromQuery) && fromQuery >= 1 && fromQuery <= 6) return fromQuery;

  const arg = process.argv.find((a) => a.startsWith("--monitor=") || a.startsWith("--game="));
  if (arg) {
    const value = Number(arg.split("=")[1]);
    if (Number.isInteger(value) && value >= 1 && value <= 6) return value;
  }
  return 1;
}

function readDisplayLabel(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("displayLabel");
  if (fromQuery) {
    try {
      return decodeURIComponent(fromQuery);
    } catch {
      return fromQuery;
    }
  }
  const arg = process.argv.find((a) => a.startsWith("--display-label="));
  if (!arg) return "";
  try {
    return Buffer.from(arg.slice("--display-label=".length), "base64").toString("utf8");
  } catch {
    return "";
  }
}

contextBridge.exposeInMainWorld("displayApi", {
  getMonitorSlot: () => readMonitorSlot(),
  getDisplayLabel: () => readDisplayLabel(),
  getTheme: () => ipcRenderer.invoke("theme:get") as Promise<UiThemeId>,
  onThemeUpdate: (cb: (theme: UiThemeId) => void) => {
    const h = (_e: Electron.IpcRendererEvent, theme: UiThemeId) => cb(theme);
    ipcRenderer.on("theme:update", h);
    return () => ipcRenderer.removeListener("theme:update", h);
  },
  getTimerLook: () => ipcRenderer.invoke("timerLook:get") as Promise<TimerLook | null>,
  onTimerLookUpdate: (cb: (look: TimerLook | null) => void) => {
    const h = (_e: Electron.IpcRendererEvent, look: TimerLook | null) => cb(look);
    ipcRenderer.on("timerLook:update", h);
    return () => ipcRenderer.removeListener("timerLook:update", h);
  },
  getSoundVolume: () => ipcRenderer.invoke("soundVolume:get") as Promise<number>,
  onSoundVolumeUpdate: (cb: (volume: number) => void) => {
    const h = (_e: Electron.IpcRendererEvent, volume: number) => cb(volume);
    ipcRenderer.on("soundVolume:update", h);
    return () => ipcRenderer.removeListener("soundVolume:update", h);
  },
  onTimerUpdate: (cb: (state: TableTimerState) => void) => {
    const h = (_e: Electron.IpcRendererEvent, state: TableTimerState) => cb(state);
    ipcRenderer.on("timer:update", h);
    return () => ipcRenderer.removeListener("timer:update", h);
  },
  onSessionUpdate: (cb: (session: GameSession | null) => void) => {
    const h = (_e: Electron.IpcRendererEvent, session: GameSession | null) => cb(session);
    ipcRenderer.on("session:update", h);
    return () => ipcRenderer.removeListener("session:update", h);
  },
});

declare global {
  interface Window {
    displayApi: {
      getMonitorSlot: () => number;
      getDisplayLabel: () => string;
      getTheme: () => Promise<UiThemeId>;
      onThemeUpdate: (cb: (theme: UiThemeId) => void) => () => void;
      getTimerLook: () => Promise<TimerLook | null>;
      onTimerLookUpdate: (cb: (look: TimerLook | null) => void) => () => void;
      getSoundVolume: () => Promise<number>;
      onSoundVolumeUpdate: (cb: (volume: number) => void) => () => void;
      onTimerUpdate: (cb: (state: TableTimerState) => void) => () => void;
      onSessionUpdate: (cb: (session: GameSession | null) => void) => () => void;
    };
  }
}
