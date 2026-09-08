import { BrowserWindow } from "electron";
import type { DisplayInfo } from "../../shared/types";

let identifyWindows: BrowserWindow[] = [];
let identifyTimer: ReturnType<typeof setTimeout> | null = null;

function identifyHtml(osNumber: number): string {
  const n = String(osNumber);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#111;color:#fff;font-family:system-ui,sans-serif;
display:flex;flex-direction:column;align-items:center;justify-content:center;user-select:none;}
.num{font-size:min(42vw,42vh);font-weight:800;line-height:1;letter-spacing:-0.04em;}
.hint{margin-top:24px;font-size:28px;opacity:0.75;font-weight:600;}
</style></head><body>
<div class="num">${n}</div>
<div class="hint">디스플레이 ${n}</div>
</body></html>`;
}

export function flashDisplayIdentify(displays: DisplayInfo[], ms = 2800): void {
  clearDisplayIdentify();
  identifyWindows = displays.map((d) => {
    const win = new BrowserWindow({
      x: d.bounds.x,
      y: d.bounds.y,
      width: d.bounds.width,
      height: d.bounds.height,
      frame: false,
      transparent: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      resizable: false,
      movable: false,
      fullscreen: true,
      simpleFullscreen: true,
      backgroundColor: "#111111",
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(identifyHtml(d.osNumber))}`);
    win.once("ready-to-show", () => {
      if (!win.isDestroyed()) win.showInactive();
    });
    return win;
  });
  identifyTimer = setTimeout(() => clearDisplayIdentify(), ms);
}

export function clearDisplayIdentify(): void {
  if (identifyTimer) {
    clearTimeout(identifyTimer);
    identifyTimer = null;
  }
  for (const win of identifyWindows) {
    if (!win.isDestroyed()) win.destroy();
  }
  identifyWindows = [];
}
