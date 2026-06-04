import { seatIntegratedStyle } from "@/lib/poker/seat-integrated";

/** 캡슬/통합 테이블 좌석 앵커 (seat-integrated 타원과 동일) */
export type SeatAnchor = {
  left: number;
  top: number;
  place: "left" | "right";
};

export function getSeatCapsuleAnchor(seatNumber: number): SeatAnchor {
  const style = seatIntegratedStyle(seatNumber);
  const left = parseFloat(String(style.left)) || 50;
  const top = parseFloat(String(style.top)) || 50;
  return {
    left,
    top,
    place: left < 48 ? "right" : "left",
  };
}
