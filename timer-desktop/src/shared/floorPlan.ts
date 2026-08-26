import { MISA_VENUE_ID, YEOKSAM_VENUE_ID, isKnownVenueId } from "@mnf/venue";
import type { AppSnapshot, MonitorSlot } from "./types";

export const DEFAULT_MONITOR_KEYS: Record<string, number> = {
  q: 5, a: 3, z: 1, r: 6, f: 4, v: 2,
};
export const DEFAULT_TABLE_KEYS: Record<string, number> = {
  w: 5, s: 3, x: 1, e: 6, d: 4, c: 2,
};

/** D=a, B=s, C=d */
export const YEOKSAM_TABLE_KEYS: Record<string, number> = {
  a: 4, s: 2, d: 3,
};
/** Dt=w, Bt=q, Ct=c, Bm=x */
export const YEOKSAM_MONITOR_KEYS: Record<string, number> = {
  q: 2, w: 4, c: 3, x: 1,
};

export const YEOKSAM_MONITOR_LABELS: Record<number, string> = {
  1: "Bm",
  2: "Bt",
  3: "Ct",
  4: "Dt",
  5: "Dm",
  6: "Cm",
};

/** 역삼 설정 화면: 이 PC에 꽂힌 TV·모니터를 매장 슬롯에 연결 */
export const YEOKSAM_SHOP_OUTPUTS: ReadonlyArray<{ slot: MonitorSlot; label: string }> = [
  { slot: 4, label: "Dt (D TV)" },
  { slot: 2, label: "Bt (B TV)" },
  { slot: 3, label: "Ct (C TV)" },
  { slot: 1, label: "Bm (B 모니터)" },
  { slot: 5, label: "Dm (D 모니터)" },
  { slot: 6, label: "Cm (C 모니터)" },
];

export const YEOKSAM_TABLE_HOTKEY: Record<number, string> = {
  2: "S",
  3: "D",
  4: "A",
};
export const YEOKSAM_MONITOR_HOTKEY: Record<number, string> = {
  1: "X",
  2: "Q",
  3: "C",
  4: "W",
};

export function isYeoksamFloor(venueId: string | null | undefined): boolean {
  const id = isKnownVenueId(venueId) ? venueId : YEOKSAM_VENUE_ID;
  return id !== MISA_VENUE_ID;
}

export function floorHotkeys(venueId: string | null | undefined): {
  table: Record<string, number>;
  monitor: Record<string, number>;
} {
  if (isYeoksamFloor(venueId)) {
    return { table: YEOKSAM_TABLE_KEYS, monitor: YEOKSAM_MONITOR_KEYS };
  }
  return { table: DEFAULT_TABLE_KEYS, monitor: DEFAULT_MONITOR_KEYS };
}

export function monitorLabel(venueId: string | null | undefined, slot: number): string {
  if (isYeoksamFloor(venueId)) return YEOKSAM_MONITOR_LABELS[slot] ?? `M${slot}`;
  return `M${slot}`;
}

export function controlOutputSlotOf(config: { venueId?: string; controlOutputSlot?: number | null } | null): number | null {
  if (!config || !isYeoksamFloor(config.venueId)) return null;
  const slot = config.controlOutputSlot;
  if (typeof slot === "number" && Number.isInteger(slot) && slot >= 1 && slot <= 6) return slot;
  return null;
}

/** 이 PC 로컬 화면: Dm/Cm은 배치도에 버튼이 없어도 Dt/Ct(또는 D/C 테이블) 게임을 따른다. */
export function yeoksamOutputGameId(snapshot: AppSnapshot, slot: number): number | null {
  const assigned = snapshot.monitorAssignments[slot];
  if (typeof assigned === "number" && assigned > 0) return assigned;
  const fallbackSlot = slot === 5 ? 4 : slot === 6 ? 3 : null;
  if (fallbackSlot == null) return assigned ?? null;
  const screen = snapshot.monitorAssignments[fallbackSlot];
  if (typeof screen === "number" && screen > 0) return screen;
  const table = snapshot.tableAssignments[fallbackSlot];
  return typeof table === "number" && table > 0 ? table : null;
}
