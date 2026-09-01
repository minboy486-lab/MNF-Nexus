import type { Metadata } from "next";
import { PublicHighHandClient } from "@/components/ranking/PublicHighHandClient";
import { getHighHandsForDate } from "@/lib/data/high-hand-queries";
import { getVenueOperatingDate } from "@/lib/venue/operating-date";
import { getActivePublicVenueId } from "@/lib/ranking/public-venue";
import { venueById } from "@/lib/venue/constants";

export const metadata: Metadata = {
  title: "하이핸드 | MNF HOLDEM",
  description: "MNF 홀덤펍 오늘의 하이핸드",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function PublicHighHandPage({ searchParams }: Props) {
  const venueId = await getActivePublicVenueId();
  const venue = venueById(venueId);
  const params = await searchParams;
  const hasDateInUrl = Boolean(params.date);
  const playDate = params.date ?? getVenueOperatingDate();
  const entries = await getHighHandsForDate(playDate, venueId);

  return (
    <PublicHighHandClient
      playDate={playDate}
      hasDateInUrl={hasDateInUrl}
      entries={entries}
      venueId={venueId}
      venueName={venue?.name ?? "매장"}
    />
  );
}
