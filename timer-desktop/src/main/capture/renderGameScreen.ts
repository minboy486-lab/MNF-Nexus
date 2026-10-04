import { BrowserWindow, ipcMain } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TableTimerState } from "@mnf/timer/types";
import type { GameSession, UiThemeId } from "../../shared/types";
import type { TimerLook } from "../../shared/timerLook";

export type GameScreenCapturePayload = {
  session: GameSession;
  state: TableTimerState;
  theme: UiThemeId;
  look: TimerLook | null;
  venueId: string;
};

function isDevRuntime(): boolean {
  return Boolean(process.env.ELECTRON_RENDERER_URL) || process.env.NODE_ENV === "development";
}

function displayPreloadPath(): string {
  return join(__dirname, "../preload/display.js");
}

/**
 * 송출 모니터 없이 BroadcastStage를 숨은 창에 그려 JPEG로 캡처한다.
 */
export async function renderGameScreenJpeg(
  payload: GameScreenCapturePayload,
): Promise<{ mime: "image/jpeg"; base64: string } | null> {
  const requestId = `cap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: "#0a0b10",
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: displayPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  let onReady: ((e: Electron.IpcMainEvent, id: unknown) => void) | null = null;

  try {
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("capture timeout")), 10_000);
      onReady = (_e, id) => {
        if (id !== requestId) return;
        clearTimeout(timer);
        if (onReady) ipcMain.removeListener("capture:ready", onReady);
        onReady = null;
        resolve();
      };
      ipcMain.on("capture:ready", onReady);
    });

    if (isDevRuntime() && process.env.ELECTRON_RENDERER_URL) {
      await win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/display/index.html?capture=1`);
    } else {
      await win.loadFile(join(__dirname, "../renderer/display/index.html"), {
        query: { capture: "1" },
      });
    }

    try {
      await win.webContents.executeJavaScript(
        "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
      );
    } catch {
      /* ignore font wait */
    }

    win.webContents.send("capture:payload", { requestId, ...payload });
    await ready;
    await new Promise((r) => setTimeout(r, 150));

    const img = await win.webContents.capturePage();
    const buf = img.toJPEG(88);
    if (!buf.length) return null;
    return { mime: "image/jpeg", base64: buf.toString("base64") };
  } catch (e) {
    console.error("[capture] renderGameScreen 실패", e);
    return null;
  } finally {
    if (onReady) ipcMain.removeListener("capture:ready", onReady);
    if (!win.isDestroyed()) win.destroy();
  }
}

export function captureResourcesOk(): boolean {
  if (isDevRuntime() && process.env.ELECTRON_RENDERER_URL) return true;
  return existsSync(join(__dirname, "../renderer/display/index.html"));
}
