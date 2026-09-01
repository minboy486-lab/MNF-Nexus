import type { GameSession, TableSlot } from "./types";

export const PARTICIPATION_BUY_IN_POINTS = 3;

export const RANK_MONEY_IN_POINTS: Record<number, number> = {
  1: 10,
  2: 9,
  3: 8,
};

export function moneyInPointsForRank(rank: number | null | undefined, manual?: number): number {
  if (rank != null && rank >= 1 && rank <= 3) return RANK_MONEY_IN_POINTS[rank] ?? 0;
  if (manual != null && Number.isFinite(manual)) return Math.max(0, Math.round(manual));
  return 0;
}

export interface GameParticipant {
  memberId: string;
  nickname: string;
  visitId?: string;
  tableSlot: TableSlot | null;
  /** 손님별 리바인 횟수 (1→1차, 2→2차 …) */
  rebuyCount: number;
  /** 싯아웃 시 players에서 제외, entries는 유지 */
  sitOut: boolean;
  /** 드래그 정렬 순서 */
  sortOrder: number;
}

export function normalizeParticipant(p: GameParticipant, index = 0): GameParticipant {
  return {
    memberId: p.memberId,
    nickname: p.nickname,
    visitId: p.visitId,
    tableSlot: p.tableSlot ?? null,
    rebuyCount: typeof p.rebuyCount === "number" && p.rebuyCount >= 0 ? p.rebuyCount : 0,
    sitOut: Boolean(p.sitOut),
    sortOrder: typeof p.sortOrder === "number" ? p.sortOrder : index,
  };
}

export function sortParticipants(participants: GameParticipant[]): GameParticipant[] {
  return [...participants].sort((a, b) => {
    const orderDiff = a.sortOrder - b.sortOrder;
    if (orderDiff !== 0) return orderDiff;
    return a.nickname.localeCompare(b.nickname, "ko");
  });
}

export function distributeRebuysToTiers(totalRebuyCount: number, tierCount: number): number[] {
  if (tierCount <= 0) return [];
  if (totalRebuyCount <= 0) return Array.from({ length: tierCount }, () => 0);
  if (tierCount === 1) return [totalRebuyCount];

  const result = Array.from({ length: tierCount }, () => 0);
  let remaining = totalRebuyCount;
  for (let i = 0; i < tierCount - 1 && remaining > 0; i++) {
    result[i] = 1;
    remaining -= 1;
  }
  result[tierCount - 1] = remaining;
  return result;
}

export function syncCountersFromParticipants(session: GameSession): void {
  session.entries = session.participants.length;
  session.players = session.participants.filter((p) => !p.sitOut).length;
  const tierCount = session.rebuyCount;
  const totals = Array.from({ length: tierCount }, () => 0);
  for (const p of session.participants) {
    const tiers = distributeRebuysToTiers(p.rebuyCount, tierCount);
    for (let i = 0; i < tierCount; i++) {
      totals[i]! += tiers[i] ?? 0;
    }
  }
  session.rebuys = totals;
}

export type RankingEntry = {
  memberId: string;
  nickname: string;
  rank: number | null;
  buyInPoints?: number;
  moneyInPoints?: number;
};

export function normalizeGameSession(session: GameSession): GameSession {
  const participants = Array.isArray(session.participants)
    ? session.participants.map((p, i) => normalizeParticipant(p as GameParticipant, i))
    : [];
  return {
    ...session,
    participants,
    dailyGameNo: typeof session.dailyGameNo === "number" && session.dailyGameNo > 0 ? session.dailyGameNo : 1,
    scoresSubmitted: session.scoresSubmitted ?? false,
  };
}

export function buildScoreRowsFromRankings(
  participants: GameParticipant[],
  rankings: RankingEntry[],
): { memberId: string; nickname: string; buyInPoints: number; rebuyPoints: number; moneyInPoints: number }[] {
  const rankByMember = new Map(rankings.map((r) => [r.memberId, r]));
  return participants.map((p) => {
    const r = rankByMember.get(p.memberId);
    return {
      memberId: p.memberId,
      nickname: p.nickname,
      buyInPoints: r?.buyInPoints ?? PARTICIPATION_BUY_IN_POINTS,
      rebuyPoints: 0,
      moneyInPoints: r?.moneyInPoints ?? 0,
    };
  });
}
