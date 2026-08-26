import type { Metadata } from "next";
import { PublicHighHandClient } from "@/components/ranking/PublicHighHandClient";
import { getHighHandsForDate } from "@/lib/data/high-hand-queries";
import { YEOKSAM_VENUE_ID } from "@/lib/venue/constants";
import { getVenueOperatingDate } from "@/lib/venue/operating-date";

export const metadata: Metadata = {
  title: "하이핸드 | MNF HOLDEM",
  description: "MNF 홀덤펍 오늘의 하이핸드",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function PublicHighHandPage({ searchParams }: Props) {
  const params = await searchParams;
  const hasDateInUrl = Boolean(params.date);
  const playDate = params.date ?? getVenueOperatingDate();
  const entries = await getHighHandsForDate(playDate, YEOKSAM_VENUE_ID);

  return (
    <PublicHighHandClient
      playDate={playDate}
      hasDateInUrl={hasDateInUrl}
      entries={entries}
    />
  );
}
