import { BrowserWindow } from "electron";
import { join } from "node:path";
import type { DisplayInfo } from "../../shared/types";

function isDevRuntime(): boolean {
  return Boolean(process.env.ELECTRON_RENDERER_URL) || process.env.NODE_ENV === "development";
}

function preloadPath(name: "control" | "display"): string {
  return join(__dirname, `../preload/${name}.js`);
}

function centerOnDisplay(display: DisplayInfo, width: number, height: number) {
  return {
    x: Math.round(display.bounds.x + (display.bounds.width - width) / 2),
    y: Math.round(display.bounds.y + (display.bounds.height - height) / 2),
  };
}

export function createControlWindow(display: DisplayInfo): BrowserWindow {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    minWidth: 480,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: "MNF Timer Control",
    webPreferences: {
      preload: preloadPath("control"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => {
    win.show();
    win.maximize();
  });

  if (isDevRuntime() && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/control/index.html`);
  } else {
    void win.loadFile(join(__dirname, "../renderer/control/index.html"));
  }

  return win;
}

export function createDisplayWindow(display: DisplayInfo, monitorSlot: number): BrowserWindow {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    show: false,
    frame: false,
    kiosk: true,
    fullscreen: true,
    autoHideMenuBar: true,
    title: `MNF Monitor ${monitorSlot}`,
    webPreferences: {
      preload: preloadPath("display"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--monitor=${monitorSlot}`],
    },
  });

  win.on("ready-to-show", () => {
    win.show();
    win.setFullScreen(true);
  });

  if (isDevRuntime() && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(
      `${process.env.ELECTRON_RENDERER_URL}/display/index.html?monitor=${monitorSlot}`,
    );
  } else {
    void win.loadFile(join(__dirname, "../renderer/display/index.html"), {
      query: { monitor: String(monitorSlot) },
    });
  }

  return win;
}
