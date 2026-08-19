import { contextBridge, ipcRenderer } from "electron";
import type { TableTimerState } from "@mnf/timer/types";
import type { GameSession } from "../shared/types";

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

contextBridge.exposeInMainWorld("displayApi", {
  getMonitorSlot: () => readMonitorSlot(),
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
      onTimerUpdate: (cb: (state: TableTimerState) => void) => () => void;
      onSessionUpdate: (cb: (session: GameSession | null) => void) => () => void;
    };
  }
}
