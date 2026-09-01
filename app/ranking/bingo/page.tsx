import type { Metadata } from "next";
import { PublicBingoClient } from "@/components/ranking/PublicBingoClient";
import { getBingoMonthSheet } from "@/lib/data/bingo-queries";
import { currentMonthKey } from "@/lib/events/types";
import { getActivePublicVenueId } from "@/lib/ranking/public-venue";
import { venueById } from "@/lib/venue/constants";

export const metadata: Metadata = {
  title: "빙고 | MNF HOLDEM",
  description: "MNF 홀덤펍 이벤트 빙고",
};

export const dynamic = "force-dynamic";

export default async function PublicBingoPage() {
  const venueId = await getActivePublicVenueId();
  const venue = venueById(venueId);
  const monthKey = currentMonthKey();
  const sheet = await getBingoMonthSheet(monthKey, venueId);

  return (
    <PublicBingoClient sheet={sheet} venueId={venueId} venueName={venue?.name ?? "매장"} />
  );
}
