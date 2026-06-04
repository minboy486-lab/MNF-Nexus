/** 11석 타원 배치 (좌석 1 = 하단 중앙, 시계 방향) */
export function seatEllipseStyle(seatNumber: number): {
  left: string;
  top: string;
  transform: string;
} {
  const i = seatNumber - 1;
  const rx = 46;
  const ry = 44;
  const theta = Math.PI / 2 + i * ((2 * Math.PI) / 11);
  const left = 50 + rx * Math.cos(theta);
  const top = 50 + ry * Math.sin(theta);
  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: "translate(-50%, -50%)",
  };
}
