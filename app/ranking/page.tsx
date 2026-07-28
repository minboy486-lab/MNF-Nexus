import type { Metadata } from "next";
import { PublicRankingClient } from "@/components/ranking/PublicRankingClient";
import {
  currentMonthRange,
  formatMonthLabel,
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
    getScoreRanking(month.from, month.to),
    getScoreRanking(prevMonth.from, prevMonth.to),
  ]);

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto w-full relative">
      <div className="bg-mesh" aria-hidden />
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-5 pb-10">
        <PublicRankingClient
          ranking={ranking}
          prevMonthTop={prevRanking[0] ?? null}
          monthLabel={formatMonthLabel(month.from)}
        />
      </main>
    </div>
  );
}
