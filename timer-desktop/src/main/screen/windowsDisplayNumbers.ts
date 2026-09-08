import { execFileSync } from "node:child_process";

export type WindowsMonitorHint = {
  /** Windows `\\.\DISPLAYN` 의 N — 디스플레이 설정의 식별 번호와 대체로 동일 */
  osNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
};

let cache: { at: number; hints: WindowsMonitorHint[] } | null = null;
const CACHE_MS = 3000;

/**
 * Windows Forms Screen API로 `\\.\DISPLAYN` 번호와 bounds를 읽는다.
 * Electron display.id(해시)와 달리 설정 앱 Identify 번호에 가깝다.
 */
export function readWindowsMonitorHintsSync(): WindowsMonitorHint[] {
  if (process.platform !== "win32") return [];
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.hints;

  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "[System.Windows.Forms.Screen]::AllScreens | ForEach-Object {",
    "  $n = if ($_.DeviceName -match 'DISPLAY(\\d+)$') { [int]$Matches[1] } else { 0 }",
    "  Write-Output ($n.ToString() + '|' + $_.Bounds.X + '|' + $_.Bounds.Y + '|' + $_.Bounds.Width + '|' + $_.Bounds.Height + '|' + ($(if ($_.Primary) { '1' } else { '0' })))",
    "}",
  ].join("; ");

  try {
    const stdout = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 8000, encoding: "utf8" },
    );
    const hints: WindowsMonitorHint[] = [];
    for (const line of String(stdout).split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      const [n, x, y, w, h, p] = t.split("|");
      const osNumber = Number(n);
      if (!Number.isInteger(osNumber) || osNumber < 1) continue;
      hints.push({
        osNumber,
        x: Number(x),
        y: Number(y),
        width: Number(w),
        height: Number(h),
        primary: p === "1",
      });
    }
    cache = { at: now, hints };
    return hints;
  } catch {
    return cache?.hints ?? [];
  }
}

export function matchOsNumber(
  bounds: { x: number; y: number; width: number; height: number },
  hints: WindowsMonitorHint[],
): number | null {
  if (hints.length === 0) return null;
  const exact = hints.find(
    (h) => h.x === bounds.x && h.y === bounds.y && h.width === bounds.width && h.height === bounds.height,
  );
  if (exact) return exact.osNumber;

  let best: WindowsMonitorHint | null = null;
  let bestDist = Infinity;
  for (const h of hints) {
    const dist =
      Math.abs(h.x - bounds.x) +
      Math.abs(h.y - bounds.y) +
      Math.abs(h.width - bounds.width) +
      Math.abs(h.height - bounds.height);
    if (dist < bestDist) {
      bestDist = dist;
      best = h;
    }
  }
  if (best && bestDist <= 8) return best.osNumber;
  return null;
}
