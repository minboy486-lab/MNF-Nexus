import type { AppConfig, DisplayBounds, MonitorMapping } from "./types";

/** 매핑 복구에 필요한 현재 모니터 스냅샷 (Electron DisplayInfo 호환) */
export type RemapDisplay = {
  id: number;
  osNumber: number;
  label: string;
  bounds: DisplayBounds;
  isPrimary: boolean;
};

type Rect = DisplayBounds;

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

function boundsNearlyEqual(a: Rect, b: Rect, px = 24): boolean {
  return (
    Math.abs(a.x - b.x) <= px &&
    Math.abs(a.y - b.y) <= px &&
    Math.abs(a.width - b.width) <= px &&
    Math.abs(a.height - b.height) <= px
  );
}

/**
 * 저장된 매핑 ↔ 현재 모니터를 1:1로 다시 짝짓는다.
 * displayId가 재부팅 후 바뀌어도 bounds 배치(동일 LED TV)로 복구한다.
 */
export function rematchMonitorConfig(config: AppConfig, displays: RemapDisplay[]): AppConfig {
  if (displays.length === 0) return config;

  const byId = new Map(displays.map((d) => [d.id, d]));
  const pairByMapping = new Map<number, number>();
  const usedDisplayIds = new Set<number>();

  const take = (mappingIndex: number, displayId: number) => {
    if (usedDisplayIds.has(displayId) || pairByMapping.has(mappingIndex)) return false;
    if (!byId.has(displayId)) return false;
    usedDisplayIds.add(displayId);
    pairByMapping.set(mappingIndex, displayId);
    return true;
  };

  // 1) displayId 유지
  config.mappings.forEach((m, i) => {
    if (byId.has(m.displayId)) take(i, m.displayId);
  });

  const pending = () =>
    config.mappings
      .map((m, i) => ({ m, i }))
      .filter(({ i }) => !pairByMapping.has(i));

  const free = () => displays.filter((d) => !usedDisplayIds.has(d.id));

  // 2) osNumber
  for (const { m, i } of pending()) {
    if (typeof m.osNumber !== "number" || m.osNumber < 1) continue;
    const hit = free().find((d) => d.osNumber === m.osNumber);
    if (hit) take(i, hit.id);
  }

  // 3) 절대 bounds
  for (const { m, i } of pending()) {
    if (!m.bounds) continue;
    const hit = free().find((d) => boundsNearlyEqual(d.bounds, m.bounds!));
    if (hit) take(i, hit.id);
  }

  // 4) 상대 배치 (동일 해상도 LED TV 구분) — 전체 배치 좌표계 기준
  {
    const left = pending().filter(({ m }) => !!m.bounds);
    const available = free();
    const allSavedBounds = config.mappings.map((m) => m.bounds).filter((b): b is DisplayBounds => !!b);
    if (left.length > 0 && available.length > 0 && allSavedBounds.length > 0) {
      const sBox = bbox(allSavedBounds);
      const dBox = bbox(displays.map((d) => d.bounds));
      const candidates: Array<{ mappingIndex: number; displayId: number; dist: number }> = [];
      for (const { m, i } of left) {
        const sc = normCenter(m.bounds!, sBox);
        for (const d of available) {
          const dc = normCenter(d.bounds, dBox);
          candidates.push({
            mappingIndex: i,
            displayId: d.id,
            dist: Math.hypot(sc.x - dc.x, sc.y - dc.y),
          });
        }
      }
      candidates.sort((a, b) => a.dist - b.dist);
      for (const c of candidates) {
        if (c.dist > 0.45) continue;
        take(c.mappingIndex, c.displayId);
      }
    }
  }

  const mappings: MonitorMapping[] = config.mappings.map((m, i) => {
    const displayId = pairByMapping.get(i) ?? m.displayId;
    const d = byId.get(displayId);
    if (!d) return m;
    return {
      ...m,
      displayId: d.id,
      label: d.label,
      bounds: d.bounds,
      osNumber: d.osNumber,
    };
  });

  let controlDisplayId = config.controlDisplayId;
  if (!byId.has(controlDisplayId)) {
    const oldIdx = config.mappings.findIndex((m) => m.displayId === config.controlDisplayId);
    const remapped = oldIdx >= 0 ? pairByMapping.get(oldIdx) : undefined;
    if (remapped != null && byId.has(remapped)) {
      controlDisplayId = remapped;
    } else {
      const old = oldIdx >= 0 ? config.mappings[oldIdx] : undefined;
      const byOs =
        old && typeof old.osNumber === "number"
          ? displays.find((d) => d.osNumber === old.osNumber)
          : undefined;
      const byBounds = old?.bounds
        ? displays.find((d) => boundsNearlyEqual(d.bounds, old.bounds!))
        : undefined;
      controlDisplayId = byOs?.id ?? byBounds?.id ?? displays.find((d) => d.isPrimary)?.id ?? controlDisplayId;
    }
  }

  return { ...config, controlDisplayId, mappings };
}

/** displayId 매핑이 바뀌었는지 (디스크 재저장 여부) */
export function monitorConfigIdsChanged(before: AppConfig, after: AppConfig): boolean {
  if (before.controlDisplayId !== after.controlDisplayId) return true;
  if (before.mappings.length !== after.mappings.length) return true;
  for (let i = 0; i < before.mappings.length; i++) {
    const a = before.mappings[i];
    const b = after.mappings[i];
    if (a.displayId !== b.displayId) return true;
    if ((a.osNumber ?? null) !== (b.osNumber ?? null)) return true;
  }
  return false;
}
