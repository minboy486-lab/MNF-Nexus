import { MISA_VENUE_ID, YEOKSAM_VENUE_ID, isKnownVenueId } from "@mnf/venue";
import { normalizeYeoksamRole, type AppSnapshot, type MonitorSlot, type YeoksamRole } from "./types";

/** 미사 A~E. 테이블 xcsdw, 모니터 zvafq */
export const DEFAULT_MONITOR_KEYS: Record<string, number> = {
  z: 1, v: 2, a: 3, f: 4, q: 5,
};
export const DEFAULT_TABLE_KEYS: Record<string, number> = {
  x: 1, c: 2, s: 3, d: 4, w: 5,
};

export const MISA_TABLE_HOTKEY: Record<number, string> = {
  1: "X", 2: "C", 3: "S", 4: "D", 5: "W",
};
export const MISA_MONITOR_HOTKEY: Record<number, string> = {
  1: "Z", 2: "V", 3: "A", 4: "F", 5: "Q",
};

export const MISA_MONITOR_LABELS: Record<number, string> = {
  1: "At",
  2: "Bt",
  3: "Ct",
  4: "Dt",
  5: "Et",
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
  return MISA_MONITOR_LABELS[slot] ?? `M${slot}`;
}

export function controlOutputSlotOf(config: { venueId?: string; controlOutputSlot?: number | null } | null): number | null {
  if (!config || !isYeoksamFloor(config.venueId)) return null;
  const slot = config.controlOutputSlot;
  if (typeof slot === "number" && Number.isInteger(slot) && slot >= 1 && slot <= 6) return slot;
  return null;
}

/**
 * 역삼 허브 역할. 화면을 Bm/Ct/Dt로 두는 것(controlOutputSlot)과 무관하다.
 * Control 화면을 Ct로 바꿔도 허브는 유지된다.
 */
export function resolveYeoksamShopRole(config: {
  venueId?: string;
  yeoksamRole?: unknown;
  controlOutputSlot?: number | null;
} | null): YeoksamRole {
  if (!config || !isYeoksamFloor(config.venueId)) return normalizeYeoksamRole(config?.yeoksamRole);
  if (config.yeoksamRole === "output") return "output";
  return "control";
}

/** 모니터 설정 저장: Control 화면이 있으면 허브. 없으면 기존 허브는 유지, 처음 TV만 두면 출력. */
export function yeoksamRoleAfterSetup(hasControlDisplay: boolean, previousRole?: unknown): YeoksamRole {
  if (hasControlDisplay) return "control";
  if (previousRole === "control") return "control";
  return "output";
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
