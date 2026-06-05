import type { CSSProperties } from "react";

const CENTER_X = 50;
const CENTER_Y = 50;
/** 타원 반경 (% of table) — 중앙 버튼과 겹치지 않도록 여유 */
const RX = 42;
const RY = 38;

/**
 * 상단(0°) 기준 시계 방향 각도 — 11석 등간격(30°) 호 배치
 * 6=12시 · 5→1 왼쪽 · 7→11 오른쪽 · 좌우 쌍 x축 중점 = CENTER_X
 */
const SEAT_ANGLE_DEG: Record<number, number> = {
  6: 0,
  5: -30,
  4: -60,
  3: -90,
  2: -120,
  1: -150,
  7: 30,
  8: 60,
  9: 90,
  10: 120,
  11: 150,
};

function angleToPosition(deg: number): { left: number; top: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    left: CENTER_X + RX * Math.sin(rad),
    top: CENTER_Y - RY * Math.cos(rad),
  };
}

type Nudge = { x: number; y: number };

/** 데스크톱 — "모바일만 수정" 이전 세팅 */
const DESKTOP_NUDGE_BASE: Nudge = { x: -0.05, y: -0.05 };
const DESKTOP_NUDGE_EXTRA: Partial<Record<number, Nudge>> = {
  1: { x: 0.75, y: 0.1 },
  2: { x: 0.75, y: 0.3 },
  4: { x: 0.75, y: -0.3 },
  5: { x: 0.75, y: 0 },
  7: { x: -0.75, y: 0 },
  8: { x: -0.75, y: -0.3 },
  10: { x: -0.75, y: 0.3 },
  11: { x: -0.75, y: 0.1 },
};

/** 모바일(≤1023px) — 모바일 튜닝 누적값 */
const MOBILE_NUDGE_BASE: Nudge = { x: -0.05, y: -0.05 };
const MOBILE_NUDGE_EXTRA: Partial<Record<number, Nudge>> = {
  1: { x: 0.35, y: 0.9 },
  2: { x: 0.75, y: 0 },
  3: { x: 0.5, y: 0 },
  4: { x: 0.55, y: 0.55 },
  5: { x: -0.15, y: 0.35 },
  6: { x: 0, y: -0.8 },
  7: { x: 0.15, y: 0.35 },
  8: { x: -0.55, y: 0.55 },
  9: { x: -0.5, y: 0 },
  10: { x: -0.75, y: 0 },
  11: { x: -0.05, y: 0.9 },
};

function resolveNudge(
  base: Nudge,
  extra: Partial<Record<number, Nudge>>,
  seatNumber: number,
): Nudge {
  const e = extra[seatNumber];
  return { x: base.x + (e?.x ?? 0), y: base.y + (e?.y ?? 0) };
}

function buildIntegratedPositions(): Record<number, { left: number; top: number }> {
  const pos: Record<number, { left: number; top: number }> = {};
  for (const [seat, deg] of Object.entries(SEAT_ANGLE_DEG)) {
    pos[Number(seat)] = angleToPosition(deg);
  }
  return pos;
}

const INTEGRATED_SEAT_POS = buildIntegratedPositions();

export function getIntegratedSeatPosition(seatNumber: number): { left: number; top: number } {
  return INTEGRATED_SEAT_POS[seatNumber] ?? { left: CENTER_X, top: CENTER_Y };
}

export function seatIntegratedStyle(seatNumber: number): CSSProperties {
  const pos = getIntegratedSeatPosition(seatNumber);
  const desktop = resolveNudge(DESKTOP_NUDGE_BASE, DESKTOP_NUDGE_EXTRA, seatNumber);
  const mobile = resolveNudge(MOBILE_NUDGE_BASE, MOBILE_NUDGE_EXTRA, seatNumber);

  return {
    left: `${pos.left}%`,
    top: `${pos.top}%`,
    "--seat-nudge-x-desktop": `${desktop.x}cm`,
    "--seat-nudge-y-desktop": `${desktop.y}cm`,
    "--seat-nudge-x-mobile": `${mobile.x}cm`,
    "--seat-nudge-y-mobile": `${mobile.y}cm`,
  } as CSSProperties;
}

export function getIntegratedSeatSide(seatNumber: number): "left" | "right" | "top" {
  if (seatNumber === 6) return "top";
  if (seatNumber >= 1 && seatNumber <= 5) return "left";
  return "right";
}
