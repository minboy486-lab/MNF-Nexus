import { autoUpdater } from "electron-updater";
import { BrowserWindow, ipcMain } from "electron";

autoUpdater.autoDownload = false; // 자동 다운로드 비활성화 (사용자 확인 후 진행)
autoUpdater.autoInstallOnAppQuit = true;

function getControlWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? null;
}

function send(event: string, data?: unknown) {
  getControlWindow()?.webContents.send(event, data);
}

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = true;

  autoUpdater.on("checking-for-update", () => {
    send("updater:status", { status: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    send("updater:status", { status: "available", version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    send("updater:status", { status: "not-available" });
  });

  autoUpdater.on("error", (err) => {
    send("updater:status", { status: "error", message: err.message });
  });

  autoUpdater.on("download-progress", (progress) => {
    send("updater:status", { status: "downloading", percent: Math.round(progress.percent) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    send("updater:status", { status: "downloaded", version: info.version });
  });

  // IPC: 업데이트 확인
  ipcMain.handle("updater:check", async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      send("updater:status", { status: "error", message: String(e) });
    }
  });

  // IPC: 다운로드 시작
  ipcMain.handle("updater:download", async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (e) {
      send("updater:status", { status: "error", message: String(e) });
    }
  });

  // IPC: 재시작 후 설치
  ipcMain.handle("updater:install", () => {
    autoUpdater.quitAndInstall();
  });
}
