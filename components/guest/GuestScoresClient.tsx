"use client";

import { useState } from "react";
import { PublicRankingClient } from "@/components/ranking/PublicRankingClient";
import { PublicBingoClient } from "@/components/ranking/PublicBingoClient";
import { PublicHighHandClient } from "@/components/ranking/PublicHighHandClient";
import type { BingoMonthSheet } from "@/lib/events/types";
import type { HighHandEntry } from "@/lib/events/types";
import type { ScoreRankingRow } from "@/lib/scores/types";

type Tab = "ranking" | "bingo" | "highhand";

type Props = {
  memberNickname: string;
  venueName: string;
  monthLabel: string;
  ranking: ScoreRankingRow[];
  prevMonthTop: ScoreRankingRow | null;
  bingoSheet: BingoMonthSheet;
  highHandDate: string;
  highHandEntries: HighHandEntry[];
};

const TABS: { id: Tab; label: string }[] = [
  { id: "ranking", label: "승점" },
  { id: "bingo", label: "빙고" },
  { id: "highhand", label: "하이핸드" },
];

export function GuestScoresClient({
  memberNickname,
  venueName,
  monthLabel,
  ranking,
  prevMonthTop,
  bingoSheet,
  highHandDate,
  highHandEntries,
}: Props) {
  const [tab, setTab] = useState<Tab>("ranking");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">승점 및 이벤트</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {venueName} · 승점 · 빙고 · 하이핸드
        </p>
      </div>

      <div className="guest-scores-tabs" role="tablist" aria-label="승점 및 이벤트">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            data-active={tab === t.id}
            className="guest-scores-tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "ranking" && (
          <PublicRankingClient
            ranking={ranking}
            prevMonthTop={prevMonthTop}
            monthLabel={monthLabel}
            memberNickname={memberNickname}
            embedded
          />
        )}
        {tab === "bingo" && (
          <PublicBingoClient sheet={bingoSheet} memberNickname={memberNickname} embedded />
        )}
        {tab === "highhand" && (
          <PublicHighHandClient
            playDate={highHandDate}
            hasDateInUrl={false}
            entries={highHandEntries}
            memberNickname={memberNickname}
            embedded
            refreshPath="/guest/scores"
          />
        )}
      </div>
    </div>
  );
}
