import { getIntegratedSeatSide, seatIntegratedStyle } from "@/lib/poker/seat-integrated";

/** 캡슬/통합 테이블 좌석 앵커 */
export type SeatAnchorPlacement = "left" | "right" | "above" | "below";

export type SeatAnchor = {
  left: number;
  top: number;
  placement: SeatAnchorPlacement;
};

export function getSeatCapsuleAnchor(seatNumber: number): SeatAnchor {
  const style = seatIntegratedStyle(seatNumber);
  const left = parseFloat(String(style.left)) || 50;
  const top = parseFloat(String(style.top)) || 50;

  if (top >= 65) return { left, top, placement: "above" };
  if (top <= 22) return { left, top, placement: "below" };

  const side = getIntegratedSeatSide(seatNumber);
  return {
    left,
    top,
    placement: side === "left" ? "right" : "left",
  };
}
