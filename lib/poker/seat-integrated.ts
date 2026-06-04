import type { CSSProperties } from "react";

/** 11석 — 테이블 중심 기준 타원 배치 (겹침 방지) */
const SEAT_COUNT = 11;
/** 좌석 중심 반경 (% of table) */
const RX = 32;
const RY = 29;

/**
 * seat 1 = 하단 중앙, 시계 방향
 * @param seatNumber 1–11
 */
export function seatIntegratedStyle(seatNumber: number): CSSProperties {
  const idx = Math.max(0, Math.min(SEAT_COUNT - 1, seatNumber - 1));
  const theta = Math.PI / 2 + idx * ((2 * Math.PI) / SEAT_COUNT);
  const left = 50 + RX * Math.cos(theta);
  const top = 50 + RY * Math.sin(theta);
  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: "translate(-50%, -50%)",
  };
}
