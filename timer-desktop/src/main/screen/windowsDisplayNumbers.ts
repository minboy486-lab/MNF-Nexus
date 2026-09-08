import { execFileSync } from "node:child_process";

export type WindowsMonitorHint = {
  /** Windows 디스플레이 설정 Identify 번호에 가깝게 맞춘 번호 */
  osNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
};

type Rect = { x: number; y: number; width: number; height: number };

let cache: { at: number; hints: WindowsMonitorHint[] } | null = null;
const CACHE_MS = 3000;

/**
 * QueryDisplayConfig 로 활성 path의 source 위치·id 를 읽는다.
 * Settings Identify 번호는 GDI `\\.\DISPLAYn` 과 다를 수 있어 CCD path 를 우선한다.
 */
function readViaQueryDisplayConfig(): WindowsMonitorHint[] {
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class Qdc {
  public const uint QDC_ONLY_ACTIVE_PATHS = 2;
  public const int DISPLAYCONFIG_MODE_INFO_TYPE_SOURCE = 1;
  [StructLayout(LayoutKind.Sequential)] public struct LUID { public uint LowPart; public int HighPart; }
  [StructLayout(LayoutKind.Sequential)] public struct POINTL { public int x; public int y; }
  [StructLayout(LayoutKind.Sequential)] public struct DISPLAYCONFIG_RATIONAL { public uint Numerator; public uint Denominator; }
  [StructLayout(LayoutKind.Sequential)] public struct DISPLAYCONFIG_PATH_SOURCE_INFO {
    public LUID adapterId; public uint id; public uint modeInfoIdx; public uint statusFlags;
  }
  [StructLayout(LayoutKind.Sequential)] public struct DISPLAYCONFIG_PATH_TARGET_INFO {
    public LUID adapterId; public uint id; public uint modeInfoIdx; public uint outputTechnology;
    public uint rotation; public uint scaling; public DISPLAYCONFIG_RATIONAL refreshRate;
    public uint scanLineOrdering; public bool targetAvailable; public uint statusFlags;
  }
  [StructLayout(LayoutKind.Sequential)] public struct DISPLAYCONFIG_PATH_INFO {
    public DISPLAYCONFIG_PATH_SOURCE_INFO sourceInfo; public DISPLAYCONFIG_PATH_TARGET_INFO targetInfo; public uint flags;
  }
  [StructLayout(LayoutKind.Sequential)] public struct DISPLAYCONFIG_SOURCE_MODE {
    public uint width; public uint height; public uint pixelFormat; public POINTL position;
  }
  [StructLayout(LayoutKind.Explicit)] public struct DISPLAYCONFIG_MODE_INFO_UNION {
    [FieldOffset(0)] public DISPLAYCONFIG_SOURCE_MODE sourceMode;
  }
  [StructLayout(LayoutKind.Sequential)] public struct DISPLAYCONFIG_MODE_INFO {
    public uint infoType; public uint id; public LUID adapterId; public DISPLAYCONFIG_MODE_INFO_UNION modeInfo;
  }
  [DllImport("user32.dll")] public static extern int GetDisplayConfigBufferSizes(uint flags, out uint numPathArrayElements, out uint numModeInfoArrayElements);
  [DllImport("user32.dll")] public static extern int QueryDisplayConfig(uint flags, ref uint numPathArrayElements, [Out] DISPLAYCONFIG_PATH_INFO[] pathArray, ref uint numModeInfoArrayElements, [Out] DISPLAYCONFIG_MODE_INFO[] modeInfoArray, IntPtr currentTopologyId);
  public static List<string> Run() {
    var list = new List<string>();
    uint pathCount, modeCount;
    if (GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out pathCount, out modeCount) != 0) return list;
    var paths = new DISPLAYCONFIG_PATH_INFO[pathCount];
    var modes = new DISPLAYCONFIG_MODE_INFO[modeCount];
    if (QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref pathCount, paths, ref modeCount, modes, IntPtr.Zero) != 0) return list;
    for (int i = 0; i < pathCount; i++) {
      var p = paths[i];
      uint idx = p.sourceInfo.modeInfoIdx & 0xFFFF;
      if (idx >= modeCount) continue;
      var m = modes[idx];
      if (m.infoType != DISPLAYCONFIG_MODE_INFO_TYPE_SOURCE) {
        // Win8+ 인덱스 어긋남 대비: id/adapter 로 source mode 검색
        bool found = false;
        for (uint mi = 0; mi < modeCount; mi++) {
          var cand = modes[mi];
          if (cand.infoType != DISPLAYCONFIG_MODE_INFO_TYPE_SOURCE) continue;
          if (cand.id == p.sourceInfo.id && cand.adapterId.LowPart == p.sourceInfo.adapterId.LowPart && cand.adapterId.HighPart == p.sourceInfo.adapterId.HighPart) {
            m = cand;
            found = true;
            break;
          }
        }
        if (!found) continue;
      }
      var s = m.modeInfo.sourceMode;
      uint num = p.sourceInfo.id + 1;
      int primary = (s.position.x == 0 && s.position.y == 0) ? 1 : 0;
      list.Add(num + "|" + s.position.x + "|" + s.position.y + "|" + s.width + "|" + s.height + "|" + primary);
    }
    return list;
  }
}
"@
[Qdc]::Run() | ForEach-Object { $_ }
`;

  const stdout = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { windowsHide: true, timeout: 10000, encoding: "utf8" },
  );
  return parseHintLines(String(stdout));
}

/** fallback: WinForms `\\.\DISPLAYn` */
function readViaWinForms(): WindowsMonitorHint[] {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "[System.Windows.Forms.Screen]::AllScreens | ForEach-Object {",
    "  $n = if ($_.DeviceName -match 'DISPLAY(\\d+)$') { [int]$Matches[1] } else { 0 }",
    "  Write-Output ($n.ToString() + '|' + $_.Bounds.X + '|' + $_.Bounds.Y + '|' + $_.Bounds.Width + '|' + $_.Bounds.Height + '|' + ($(if ($_.Primary) { '1' } else { '0' })))",
    "}",
  ].join("; ");

  const stdout = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { windowsHide: true, timeout: 8000, encoding: "utf8" },
  );
  return parseHintLines(String(stdout));
}

function parseHintLines(stdout: string): WindowsMonitorHint[] {
  const hints: WindowsMonitorHint[] = [];
  const seen = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || !/^\d+\|/.test(t)) continue;
    const [n, x, y, w, h, p] = t.split("|");
    const osNumber = Number(n);
    if (!Number.isInteger(osNumber) || osNumber < 1) continue;
    const hint: WindowsMonitorHint = {
      osNumber,
      x: Number(x),
      y: Number(y),
      width: Number(w),
      height: Number(h),
      primary: p === "1",
    };
    const key = `${hint.x},${hint.y},${hint.width}x${hint.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hints.push(hint);
  }
  return hints;
}

export function readWindowsMonitorHintsSync(): WindowsMonitorHint[] {
  if (process.platform !== "win32") return [];
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.hints;

  let hints: WindowsMonitorHint[] = [];
  try {
    hints = readViaQueryDisplayConfig();
  } catch {
    hints = [];
  }
  if (hints.length === 0) {
    try {
      hints = readViaWinForms();
    } catch {
      hints = [];
    }
  }

  // sourceInfo.id+1 이 겹치거나 이상하면 WinForms 로 교체
  const nums = new Set(hints.map((h) => h.osNumber));
  if (hints.length > 0 && nums.size < hints.length) {
    try {
      const forms = readViaWinForms();
      if (forms.length === hints.length) hints = forms;
    } catch {
      /* keep */
    }
  }

  cache = { at: now, hints };
  return hints;
}

function bbox(rects: Rect[]): { minX: number; minY: number; w: number; h: number } {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function normCenter(r: Rect, box: { minX: number; minY: number; w: number; h: number }): { x: number; y: number } {
  return {
    x: (r.x + r.width / 2 - box.minX) / box.w,
    y: (r.y + r.height / 2 - box.minY) / box.h,
  };
}

/**
 * Electron bounds(DIP)와 Win32 bounds(물리 픽셀)는 스케일이 달라
 * 절대 좌표 매칭이 어긋난다. 배치 비율(상대 위치)로 1:1 짝짓기한다.
 */
export function assignOsNumbersByLayout(
  displays: Array<{ id: number; bounds: Rect; isPrimary?: boolean }>,
  hints: WindowsMonitorHint[],
): Map<number, number> {
  const result = new Map<number, number>();
  if (displays.length === 0 || hints.length === 0) return result;

  const usedDisplays = new Set<number>();
  const usedHints = new Set<number>();

  const primaryDisplay = displays.find((d) => d.isPrimary);
  const primaryHint = hints.find((h) => h.primary) ?? hints.find((h) => h.x === 0 && h.y === 0);
  if (primaryDisplay && primaryHint) {
    const hi = hints.indexOf(primaryHint);
    result.set(primaryDisplay.id, primaryHint.osNumber);
    usedDisplays.add(primaryDisplay.id);
    if (hi >= 0) usedHints.add(hi);
  }

  const eBox = bbox(displays.map((d) => d.bounds));
  const hBox = bbox(hints);

  const pairs: Array<{ displayId: number; hintIdx: number; dist: number }> = [];
  for (const d of displays) {
    if (usedDisplays.has(d.id)) continue;
    const ec = normCenter(d.bounds, eBox);
    for (let hi = 0; hi < hints.length; hi++) {
      if (usedHints.has(hi)) continue;
      const hc = normCenter(hints[hi], hBox);
      const dist = Math.hypot(ec.x - hc.x, ec.y - hc.y);
      pairs.push({ displayId: d.id, hintIdx: hi, dist });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);

  for (const p of pairs) {
    if (usedDisplays.has(p.displayId) || usedHints.has(p.hintIdx)) continue;
    usedDisplays.add(p.displayId);
    usedHints.add(p.hintIdx);
    result.set(p.displayId, hints[p.hintIdx].osNumber);
  }
  return result;
}
