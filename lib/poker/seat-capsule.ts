/** 캡슬 테이블 좌석 앵커 (globals.css seat-pos-* 와 맞춤) */
export type SeatAnchor = {
  left: number;
  top: number;
  /** 팝업을 좌석 기준 어느 쪽에 띄울지 */
  place: "left" | "right";
};

const CAPSULE_ANCHORS: Record<number, SeatAnchor> = {
  1: { left: 35, top: 90, place: "right" },
  2: { left: 18, top: 78, place: "right" },
  3: { left: 8, top: 55, place: "right" },
  4: { left: 12, top: 24, place: "right" },
  5: { left: 28, top: 12, place: "right" },
  6: { left: 50, top: 8, place: "right" },
  7: { left: 72, top: 12, place: "left" },
  8: { left: 88, top: 24, place: "left" },
  9: { left: 92, top: 55, place: "left" },
  10: { left: 82, top: 78, place: "left" },
  11: { left: 65, top: 90, place: "left" },
};

export function getSeatCapsuleAnchor(seatNumber: number): SeatAnchor {
  return CAPSULE_ANCHORS[seatNumber] ?? { left: 50, top: 50, place: "right" };
}
