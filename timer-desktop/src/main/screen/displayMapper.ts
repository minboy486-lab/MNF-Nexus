import { screen } from "electron";
import type { AppConfig, DisplayBounds, DisplayInfo, MonitorMapping } from "../../shared/types";

function toBounds(rect: Electron.Rectangle): DisplayBounds {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

export function getAllDisplaysInfo(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: d.label || `Display ${d.id}`,
    bounds: toBounds(d.bounds),
    workArea: toBounds(d.workArea),
    scaleFactor: d.scaleFactor,
    rotation: d.rotation,
    internal: d.internal,
    isPrimary: d.id === primary.id,
  }));
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
