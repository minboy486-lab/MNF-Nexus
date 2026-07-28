import type { Metadata } from "next";
import { PublicRankingClient } from "@/components/ranking/PublicRankingClient";
import {
  currentMonthRange,
  formatMonthLabel,
  getPublicScoreRanking,
  getScoreRanking,
  previousMonthRange,
} from "@/lib/data/manual-scores-queries";

export const metadata: Metadata = {
  title: "월별 랭킹 | MNF HOLDEM",
  description: "MNF 홀덤펍 월별 승점 랭킹",
};

export const dynamic = "force-dynamic";

export default async function PublicRankingPage() {
  const month = currentMonthRange();
  const prevMonth = previousMonthRange();

  const [ranking, prevRanking] = await Promise.all([
    getPublicScoreRanking(month.from, month.to),
    getScoreRanking(prevMonth.from, prevMonth.to),
  ]);

  return (
    <PublicRankingClient
      ranking={ranking}
      prevMonthTop={prevRanking[0] ?? null}
      monthLabel={formatMonthLabel(month.from)}
    />
  );
}
