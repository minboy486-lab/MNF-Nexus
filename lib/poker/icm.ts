/** Recursive Malmuth-Harville ICM — total equity per player for remaining prize pool. */
export function calculateIcmEquity(stacks: number[], prizePool: number): number[] {
  const n = stacks.length;
  if (n === 0) return [];
  if (n === 1) return [Math.round(prizePool)];

  const prizes = Array.from({ length: n }, () => prizePool / n);
  return calculateIcmWithPrizes(stacks, prizes).map((e) => Math.round(e));
}

function calculateIcmWithPrizes(stacks: number[], prizes: number[]): number[] {
  const n = stacks.length;
  if (n === 0) return [];
  if (n === 1) return [prizes.reduce((a, b) => a + b, 0)];

  const total = stacks.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const even = prizes.reduce((a, b) => a + b, 0) / n;
    return stacks.map(() => even);
  }

  const equity = new Array(n).fill(0);
  const firstPrize = prizes[0] ?? 0;

  for (let i = 0; i < n; i++) {
    const pWin = stacks[i] / total;
    equity[i] += pWin * firstPrize;

    const restStacks = stacks.filter((_, j) => j !== i);
    const restPrizes = prizes.slice(1);

    if (restStacks.length > 0 && restPrizes.length > 0) {
      const sub = calculateIcmWithPrizes(restStacks, restPrizes);
      let k = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        equity[j] += pWin * (sub[k] ?? 0);
        k += 1;
      }
    }
  }

  return equity;
}

export function icmChopAmounts(
  players: { memberId: string; chips: number }[],
  remainingPool: number,
): { memberId: string; amount: number }[] {
  const sorted = [...players].sort((a, b) => b.chips - a.chips);
  const stacks = sorted.map((p) => p.chips);
  const equities = calculateIcmEquity(stacks, remainingPool);
  return sorted.map((p, i) => ({
    memberId: p.memberId,
    amount: equities[i] ?? 0,
  }));
}

export function suggestPrizeAmounts(
  totalPool: number,
  payoutPlaces: number,
  placements: { rank: number; percent: number }[],
): Map<number, number> {
  const map = new Map<number, number>();
  const sorted = [...placements]
    .filter((p) => p.rank <= payoutPlaces)
    .sort((a, b) => a.rank - b.rank);

  const totalPercent = sorted.reduce((s, p) => s + p.percent, 0) || 100;

  for (const p of sorted) {
    map.set(p.rank, Math.round((totalPool * p.percent) / totalPercent));
  }
  return map;
}
