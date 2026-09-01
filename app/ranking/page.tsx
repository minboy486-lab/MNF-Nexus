import type { Metadata } from "next";
import { PublicRankingClient } from "@/components/ranking/PublicRankingClient";
import {
  currentMonthRange,
  formatMonthLabel,
  getPublicScoreRanking,
  previousMonthRange,
} from "@/lib/data/manual-scores-queries";
import { getActivePublicVenueId } from "@/lib/ranking/public-venue";
import { venueById } from "@/lib/venue/constants";

export const metadata: Metadata = {
  title: "월별 랭킹 | MNF HOLDEM",
  description: "MNF 홀덤펍 월별 승점 랭킹",
};

export const dynamic = "force-dynamic";

export default async function PublicRankingPage() {
  const venueId = await getActivePublicVenueId();
  const venue = venueById(venueId);
  const month = currentMonthRange();
  const prevMonth = previousMonthRange();

  const [ranking, prevRanking] = await Promise.all([
    getPublicScoreRanking(month.from, month.to, venueId),
    getPublicScoreRanking(prevMonth.from, prevMonth.to, venueId),
  ]);

  return (
    <PublicRankingClient
      ranking={ranking}
      prevMonthTop={prevRanking[0] ?? null}
      monthLabel={formatMonthLabel(month.from)}
      venueId={venueId}
      venueName={venue?.name ?? "매장"}
    />
  );
}
