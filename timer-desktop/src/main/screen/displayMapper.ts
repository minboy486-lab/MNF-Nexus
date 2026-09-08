import { screen } from "electron";
import type { AppConfig, DisplayBounds, DisplayInfo, MonitorMapping } from "../../shared/types";
import { matchOsNumber, readWindowsMonitorHintsSync } from "./windowsDisplayNumbers";

function toBounds(rect: Electron.Rectangle): DisplayBounds {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** bounds 기준 읽기 순서 (위→아래, 왼→오) — OS 번호를 못 읽을 때 fallback */
function fallbackOsNumbers(displays: Array<{ id: number; bounds: DisplayBounds }>): Map<number, number> {
  const sorted = [...displays].sort((a, b) => {
    if (a.bounds.y !== b.bounds.y) return a.bounds.y - b.bounds.y;
    if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
    return a.id - b.id;
  });
  const map = new Map<number, number>();
  sorted.forEach((d, i) => map.set(d.id, i + 1));
  return map;
}

export function getAllDisplaysInfo(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay();
  const raw = screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: d.label || `Display ${d.id}`,
    bounds: toBounds(d.bounds),
    workArea: toBounds(d.workArea),
    scaleFactor: d.scaleFactor,
    rotation: d.rotation,
    internal: d.internal,
    isPrimary: d.id === primary.id,
  }));

  const hints = readWindowsMonitorHintsSync();
  const fallback = fallbackOsNumbers(raw);
  const used = new Set<number>();

  const withOs = raw.map((d) => {
    const matched = matchOsNumber(d.bounds, hints);
    let osNumber = matched ?? fallback.get(d.id) ?? 1;
    if (used.has(osNumber)) {
      for (let n = 1; n <= raw.length + 8; n++) {
        if (!used.has(n)) {
          osNumber = n;
          break;
        }
      }
    }
    used.add(osNumber);
    return { ...d, osNumber };
  });

  return withOs.sort((a, b) => a.osNumber - b.osNumber || a.id - b.id);
}

export function findDisplayById(id: number): DisplayInfo | undefined {
  return getAllDisplaysInfo().find((d) => d.id === id);
}

export function resolveDisplayForMapping(mapping: MonitorMapping): DisplayInfo | undefined {
  const displays = getAllDisplaysInfo();
  const byId = displays.find((d) => d.id === mapping.displayId);
  if (byId) return byId;

  if (!mapping.bounds || !mapping.label) return undefined;
  const targetFp = `${mapping.label.trim().toLowerCase()}|${mapping.bounds.width}x${mapping.bounds.height}`;
  return displays.find((d) => {
    const fp = `${d.label.trim().toLowerCase()}|${d.bounds.width}x${d.bounds.height}`;
    return fp === targetFp;
  });
}

export function configNeedsSetup(config: AppConfig | null): boolean {
  if (!config) return true;
  return !findDisplayById(config.controlDisplayId);
}

export function enrichMappingsWithCurrentDisplays(config: AppConfig): AppConfig {
  const displays = getAllDisplaysInfo();
  const byId = new Map(displays.map((d) => [d.id, d]));

  const mappings = config.mappings.map((m) => {
    const d = byId.get(m.displayId) ?? resolveDisplayForMapping(m);
    if (!d) return m;
    return { ...m, displayId: d.id, label: d.label, bounds: d.bounds };
  });

  return {
    ...config,
    controlDisplayId: byId.has(config.controlDisplayId)
      ? config.controlDisplayId
      : (displays.find((d) => d.isPrimary)?.id ?? config.controlDisplayId),
    mappings,
  };
}
