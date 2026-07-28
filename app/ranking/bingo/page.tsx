import type { Metadata } from "next";
import { PublicBingoClient } from "@/components/ranking/PublicBingoClient";
import { getBingoMonthSheet } from "@/lib/data/bingo-queries";
import { currentMonthKey } from "@/lib/events/types";

export const metadata: Metadata = {
  title: "빙고 | MNF HOLDEM",
  description: "MNF 홀덤펍 이벤트 빙고",
};

export const dynamic = "force-dynamic";

export default async function PublicBingoPage() {
  const monthKey = currentMonthKey();
  const sheet = await getBingoMonthSheet(monthKey);

  return <PublicBingoClient sheet={sheet} />;
}
