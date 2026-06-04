/** 게임 내 화폐: 1 MP = 10,000원 (만원). DB·정산은 원 단위 유지. */
export const WON_PER_MP = 10_000;

export function wonToMp(won: number): number {
  return won / WON_PER_MP;
}

export function mpToWon(mp: number): number {
  return Math.round(mp * WON_PER_MP);
}

/** 게임·블라인드 UI용 (정산 제외) */
export function formatMp(won: number, opts?: { suffix?: boolean }): string {
  const mp = won / WON_PER_MP;
  const text =
    Math.abs(mp - Math.round(mp)) < 0.001
      ? Math.round(mp).toLocaleString("ko-KR")
      : mp.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  return opts?.suffix === false ? text : `${text} MP`;
}
