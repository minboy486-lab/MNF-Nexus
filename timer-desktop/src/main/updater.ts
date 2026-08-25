import { autoUpdater } from "electron-updater";
import { BrowserWindow, ipcMain, app } from "electron";

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function friendlyUpdaterError(raw: string): string {
  const msg = raw.replace(/^Error:\s*/i, "").trim();
  if (/not packed|dev update config/i.test(msg)) {
    return "설치된 앱에서만 업데이트할 수 있습니다.";
  }
  if (/404|latest\.yml/i.test(msg)) {
    return "업데이트 파일을 찾지 못했습니다.";
  }
  if (/net::|ENOTFOUND|ECONN|ETIMEDOUT|offline/i.test(msg)) {
    return "인터넷 연결을 확인하세요.";
  }
  return msg || "업데이트 확인에 실패했습니다.";
}

function send(event: string, data?: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(event, data);
  }
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
    send("updater:status", { status: "error", message: friendlyUpdaterError(err.message) });
  });

  autoUpdater.on("download-progress", (progress) => {
    send("updater:status", { status: "downloading", percent: Math.round(progress.percent) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    send("updater:status", { status: "downloaded", version: info.version });
  });

  ipcMain.handle("updater:check", async () => {
    if (!app.isPackaged) {
      send("updater:status", {
        status: "error",
        message: "설치된 앱에서만 업데이트할 수 있습니다.",
      });
      return;
    }
    try {
      send("updater:status", { status: "checking" });
      await autoUpdater.checkForUpdates();
    } catch (e) {
      send("updater:status", { status: "error", message: friendlyUpdaterError(String(e)) });
    }
  });

  ipcMain.handle("updater:download", async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (e) {
      send("updater:status", { status: "error", message: friendlyUpdaterError(String(e)) });
    }
  });

  ipcMain.handle("updater:install", () => {
    autoUpdater.quitAndInstall();
  });
}
