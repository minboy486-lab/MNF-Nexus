// dev 모드에서 vite define이 main process에 주입 안 되므로 직접 .env 로드
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
(function loadDotEnv() {
  const p = resolve(__dirname, "../../.env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx < 0) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
})();

import { app, BrowserWindow, screen } from "electron";
import { loadConfig } from "./config/configStore";
import { enrichMappingsWithCurrentDisplays } from "./screen/displayMapper";
import { registerIpcHandlers } from "./ipc/handlers";
import { TimerHub } from "./timer/timerHub";
import { WindowManager } from "./windows/windowManager";

const windowManager = new WindowManager();
const timerHub = new TimerHub({
  getDisplayWindowsForSlot: (slot) => windowManager.getDisplayWindowsForSlot(slot),
  getControlWindow: () => windowManager.getControlWindow(),
});

windowManager.setTimerHub(timerHub);

function registerScreenEvents(): void {
  const refresh = (): void => {
    const config = loadConfig();
    if (!config) {
      void windowManager.syncWindows();
      return;
    }
    void windowManager.applyConfig(enrichMappingsWithCurrentDisplays(config));
  };
  screen.on("display-added", refresh);
  screen.on("display-removed", refresh);
  screen.on("display-metrics-changed", refresh);
}

app.whenReady().then(async () => {
  registerIpcHandlers(windowManager, timerHub);
  registerScreenEvents();

  const saved = loadConfig();
  if (saved) {
    await windowManager.applyConfig(saved);
  } else {
    await windowManager.syncWindows();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await windowManager.syncWindows();
    }
  });
});

app.on("before-quit", () => windowManager.setQuitting(true));

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
