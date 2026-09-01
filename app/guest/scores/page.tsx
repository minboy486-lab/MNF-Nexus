import { GuestLinkPhone } from "@/components/guest/GuestLinkPhone";
import { GuestScoresClient } from "@/components/guest/GuestScoresClient";
import { getGuestMember } from "@/lib/data/guest-queries";
import { getBingoMonthSheet } from "@/lib/data/bingo-queries";
import { getHighHandsForDate } from "@/lib/data/high-hand-queries";
import {
  currentMonthRange,
  formatMonthLabel,
  getPublicScoreRanking,
  previousMonthRange,
} from "@/lib/data/manual-scores-queries";
import { currentMonthKey } from "@/lib/events/types";
import { getVenueOperatingDate } from "@/lib/venue/operating-date";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";

export const dynamic = "force-dynamic";

export default async function GuestScoresPage() {
  const member = await getGuestMember();
  if (!member) return <GuestLinkPhone />;

  const month = currentMonthRange();
  const prevMonth = previousMonthRange();
  const monthKey = currentMonthKey();
  const playDate = getVenueOperatingDate();

  const venueId = member.venue_id ?? DEFAULT_VENUE_ID;

  const [ranking, prevRanking, bingoSheet, highHandEntries] = await Promise.all([
    getPublicScoreRanking(month.from, month.to),
    getPublicScoreRanking(prevMonth.from, prevMonth.to),
    getBingoMonthSheet(monthKey, venueId),
    getHighHandsForDate(playDate, venueId),
  ]);

  return (
    <GuestScoresClient
      memberNickname={member.nickname}
      monthLabel={formatMonthLabel(month.from)}
      ranking={ranking}
      prevMonthTop={prevRanking[0] ?? null}
      bingoSheet={bingoSheet}
      highHandDate={playDate}
      highHandEntries={highHandEntries}
    />
  );
}
