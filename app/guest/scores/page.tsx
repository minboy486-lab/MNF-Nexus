import { GuestLinkPhone } from "@/components/guest/GuestLinkPhone";
import { GuestVenueEmpty } from "@/components/guest/GuestShell";
import { GuestScoresClient } from "@/components/guest/GuestScoresClient";
import { getGuestMember, getGuestVenueContext } from "@/lib/data/guest-queries";
import { getBingoMonthSheet } from "@/lib/data/bingo-queries";
import { getHighHandsForDate } from "@/lib/data/high-hand-queries";
import {
  currentMonthRange,
  formatMonthLabel,
  getScoreRanking,
  previousMonthRange,
} from "@/lib/data/manual-scores-queries";
import { currentMonthKey } from "@/lib/events/types";
import { getVenueOperatingDate } from "@/lib/venue/operating-date";
import { venueById } from "@/lib/venue/constants";

export const dynamic = "force-dynamic";

export default async function GuestScoresPage() {
  const ctx = await getGuestVenueContext();
  if (!ctx.userId || ctx.venueIds.length === 0) return <GuestLinkPhone />;

  const member = await getGuestMember();
  const venue = venueById(ctx.venueId ?? "");
  if (!member) return <GuestVenueEmpty venueName={venue?.name ?? "이 지점"} />;

  const venueId = member.venue_id ?? ctx.venueId;
  if (!venueId) return <GuestVenueEmpty venueName="이 지점" />;

  const month = currentMonthRange();
  const prevMonth = previousMonthRange();
  const monthKey = currentMonthKey();
  const playDate = getVenueOperatingDate();

  const [ranking, prevRanking, bingoSheet, highHandEntries] = await Promise.all([
    getScoreRanking(month.from, month.to, venueId),
    getScoreRanking(prevMonth.from, prevMonth.to, venueId),
    getBingoMonthSheet(monthKey, venueId),
    getHighHandsForDate(playDate, venueId),
  ]);

  return (
    <GuestScoresClient
      memberNickname={member.nickname}
      venueId={venueId}
      venueName={venue?.name ?? "매장"}
      monthLabel={formatMonthLabel(month.from)}
      ranking={ranking}
      prevMonthTop={prevRanking[0] ?? null}
      bingoSheet={bingoSheet}
      highHandDate={playDate}
      highHandEntries={highHandEntries}
    />
  );
}
