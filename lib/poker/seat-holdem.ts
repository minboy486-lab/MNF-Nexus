/** 11-max 홀덤 레이스웨이 배치 (좌석 1 = 하단 중앙, 시계 방향) */
const HOLDEM_SEATS: { left: number; top: number }[] = [
  { left: 50, top: 90 }, // 1
  { left: 30, top: 78 }, // 2
  { left: 12, top: 58 }, // 3
  { left: 10, top: 42 }, // 4
  { left: 16, top: 16 }, // 5
  { left: 34, top: 8 }, // 6
  { left: 50, top: 6 }, // 7
  { left: 66, top: 8 }, // 8
  { left: 84, top: 16 }, // 9
  { left: 90, top: 42 }, // 10
  { left: 88, top: 58 }, // 11
];

export function seatHoldemStyle(seatNumber: number): {
  left: string;
  top: string;
  transform: string;
} {
  const pos = HOLDEM_SEATS[seatNumber - 1] ?? HOLDEM_SEATS[0];
  return {
    left: `${pos.left}%`,
    top: `${pos.top}%`,
    transform: "translate(-50%, -50%)",
  };
}
