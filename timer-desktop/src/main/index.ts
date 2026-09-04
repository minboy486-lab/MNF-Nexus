// .env 로드 (dev: 프로젝트 루트 / prod: resources/.env)
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
(function loadDotEnv() {
  const candidates = [
    typeof process.resourcesPath === "string" ? join(process.resourcesPath, ".env") : "",
    resolve(__dirname, "../../.env"),
    resolve(process.cwd(), ".env"),
  ].filter(Boolean);
  const p = candidates.find((c) => existsSync(c));
  if (!p) return;
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
import { loadConfig, saveConfig } from "./config/configStore";
import { enrichMappingsWithCurrentDisplays } from "./screen/displayMapper";
import { flushPendingSoundVolume, flushWindowManagerConfig, registerIpcHandlers, stopLanView } from "./ipc/handlers";
import { TimerHub } from "./timer/timerHub";
import { WindowManager } from "./windows/windowManager";
import { setupAutoUpdater } from "./updater";
import { RemoteServer } from "./remote/server";
import { getConfiguredYeoksamRole } from "./supabase/venue";
import { shopTimerThemeEqual, shopTimerThemeFromConfig, withShopTimerTheme } from "../shared/timerLook";

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const windowManager = new WindowManager();
const timerHub = new TimerHub({
  getDisplayWindowsForSlot: (slot) => windowManager.getDisplayWindowsForSlot(slot),
  getControlWindow: () => windowManager.getControlWindow(),
});

windowManager.setTimerHub(timerHub);
const remoteServer = new RemoteServer();

function registerScreenEvents(): void {
  const refresh = (): void => {
    const config = windowManager.getConfig() ?? loadConfig();
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
  remoteServer.setAppearance(
    () => windowManager.getTheme(),
    () => windowManager.getSoundVolume(),
  );
  remoteServer.setShopThemeSync({
    get: () => windowManager.getShopTimerTheme(),
    apply: (pack) => {
      const current = windowManager.getConfig() ?? loadConfig();
      if (!current) return false;
      const next = withShopTimerTheme(current, pack);
      if (shopTimerThemeEqual(shopTimerThemeFromConfig(current), shopTimerThemeFromConfig(next))) return false;
      saveConfig(next);
      windowManager.applyShopTimerTheme(pack);
      return true;
    },
  });
  registerIpcHandlers(windowManager, timerHub, remoteServer);
  setupAutoUpdater();
  registerScreenEvents();
  try {
    await remoteServer.start(timerHub);
  } catch (e) {
    console.error("[remote] 서버 시작 실패", e);
  }

  const saved = loadConfig();
  if (saved) {
    await windowManager.applyConfig(saved);
    saveConfig(saved);
  } else {
    await windowManager.syncWindows();
  }

  if (getConfiguredYeoksamRole() !== "output" && timerHub.restoreFromDisk()) {
    timerHub.pushSnapshotToControl();
    timerHub.pushAllMonitors();
  }

  remoteServer.broadcastShopTimerTheme();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await windowManager.syncWindows();
    }
  });
});

app.on("before-quit", () => {
  timerHub.flushPersist();
  flushWindowManagerConfig(windowManager, remoteServer);
  stopLanView();
  windowManager.setQuitting(true);
  remoteServer.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
