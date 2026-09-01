"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PublicGuestHeader } from "@/components/ranking/PublicGuestHeader";
import type { ScoreRankingRow } from "@/lib/scores/types";
import { useGuestNickname } from "@/lib/ranking/use-guest-nickname";
import { usePublicScoresSync } from "@/lib/ranking/use-public-scores-sync";

type Props = {
  ranking: ScoreRankingRow[];
  prevMonthTop: ScoreRankingRow | null;
  monthLabel: string;
  venueId: string;
  venueName: string;
  /** 로그인 손님 닉네임 (설정 시 공개 닉네임 입력 생략) */
  memberNickname?: string;
  /** 손님 앱 등에 임베드 */
  embedded?: boolean;
};

type RankTier = "top" | "mid" | "low";

type RankedRow = ScoreRankingRow & { rank: number };

function rankTier(rank: number): { label: string; tier: RankTier } {
  if (rank <= 5) return { label: "TOP 5", tier: "top" };
  if (rank <= 40) return { label: "6~40위", tier: "mid" };
  return { label: "41위+", tier: "low" };
}

function tierRowClass(tier: RankTier): string {
  if (tier === "top") return "public-ranking-row-top";
  if (tier === "mid") return "public-ranking-row-mid";
  return "public-ranking-row-low";
}

function tierNumClass(tier: RankTier): string {
  if (tier === "top") return "public-ranking-rank-num-top";
  if (tier === "mid") return "public-ranking-rank-num-mid";
  return "public-ranking-rank-num-low";
}

function tierPointsClass(tier: RankTier, zero: boolean): string {
  if (zero) return "public-ranking-points-zero";
  if (tier === "top") return "public-ranking-points-top";
  if (tier === "mid") return "public-ranking-points-mid";
  return "public-ranking-points-low";
}

function tierBadgeClass(tier: RankTier): string {
  if (tier === "top") return "public-rank-badge-top";
  if (tier === "mid") return "public-rank-badge-mid";
  return "public-rank-badge-low";
}

function PodiumCard({
  row,
  rank,
  size,
  isMe,
}: {
  row: RankedRow;
  rank: 1 | 2 | 3;
  size: "lg" | "md";
  isMe: boolean;
}) {
  const heights = { 1: "public-podium-1", 2: "public-podium-2", 3: "public-podium-3" };
  const medals = { 1: "gold", 2: "silver", 3: "bronze" } as const;
  return (
    <div
      className={`public-podium-card ${heights[rank]} ${size === "lg" ? "public-podium-card-lg" : ""} ${isMe ? "public-podium-card-me" : ""}`}
    >
      <span className={`public-podium-medal public-podium-medal-${medals[rank]}`} aria-hidden>
        <span className="material-symbols-outlined">military_tech</span>
      </span>
      <div className={`public-podium-rank public-podium-rank-${medals[rank]}`}>{rank}</div>
      <p className="public-podium-name truncate">{row.nickname}</p>
      <p className="public-podium-points tabular-nums">
        {row.total_points.toLocaleString()}
        <span className="text-[10px] font-semibold opacity-75">점</span>
      </p>
      {isMe && <span className="public-rank-badge-me public-podium-me">ME</span>}
    </div>
  );
}

function PodiumTop3({
  top3,
  nickname,
}: {
  top3: RankedRow[];
  nickname: string | null;
}) {
  if (top3.length === 0) return null;
  const [first, second, third] = top3;
  const isMe = (nick: string) => nickname?.trim().toLowerCase() === nick.toLowerCase();

  return (
    <section className="public-podium mb-5" aria-label="TOP 3">
      <div className="public-podium-grid">
        {second ? (
          <PodiumCard row={second} rank={2} size="md" isMe={isMe(second.nickname)} />
        ) : (
          <div aria-hidden />
        )}
        {first ? (
          <PodiumCard row={first} rank={1} size="lg" isMe={isMe(first.nickname)} />
        ) : (
          <div aria-hidden />
        )}
        {third ? (
          <PodiumCard row={third} rank={3} size="md" isMe={isMe(third.nickname)} />
        ) : (
          <div aria-hidden />
        )}
      </div>
    </section>
  );
}

function RankRow({
  item,
  isMe,
  rowRef,
}: {
  item: RankedRow;
  isMe: boolean;
  rowRef?: React.RefObject<HTMLLIElement | null>;
}) {
  const tier = rankTier(item.rank);
  const zero = item.total_points === 0;

  return (
    <li
      ref={isMe ? rowRef : undefined}
      className={`public-ranking-row ${tierRowClass(tier.tier)} ${zero ? "public-ranking-row-zero" : ""} ${isMe ? "public-ranking-row-me" : ""}`}
    >
      <div className={`public-ranking-rank-num ${tierNumClass(tier.tier)}`}>{item.rank}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold truncate ${zero ? "text-on-surface-variant" : ""}`}>
            {item.nickname}
          </span>
          {isMe && <span className="public-rank-badge-me">ME</span>}
          <span className={`public-rank-badge ${tierBadgeClass(tier.tier)}`}>{tier.label}</span>
        </div>
      </div>
      <div className={`public-ranking-points ${tierPointsClass(tier.tier, zero)}`}>
        <span className="tabular-nums font-bold">{item.total_points.toLocaleString()}</span>
        <span className="text-[10px] opacity-80 ml-0.5">점</span>
      </div>
    </li>
  );
}

const SECTIONS: { tier: RankTier; label: string; min: number; max: number }[] = [
  { tier: "top", label: "TOP 5", min: 1, max: 5 },
  { tier: "mid", label: "6 ~ 40위", min: 6, max: 40 },
  { tier: "low", label: "41위+", min: 41, max: Infinity },
];

export function PublicRankingClient({
  ranking,
  prevMonthTop,
  monthLabel,
  venueId,
  venueName,
  memberNickname,
  embedded = false,
}: Props) {
  const guestNick = useGuestNickname();
  const nickname = memberNickname ?? guestNick.nickname;
  const ready = memberNickname ? true : guestNick.ready;
  const showNicknameModal = memberNickname ? false : guestNick.showNicknameModal;
  const saveNickname = guestNick.saveNickname;
  const openEdit = guestNick.openEdit;
  const closeEdit = guestNick.closeEdit;
  const myRowRef = useRef<HTMLLIElement>(null);

  usePublicScoresSync("ranking", venueId);

  const ranked = useMemo(
    () => ranking.map((row, i) => ({ ...row, rank: i + 1 })),
    [ranking],
  );

  const myIndex = useMemo(() => {
    if (!nickname) return -1;
    const q = nickname.trim().toLowerCase();
    return ranking.findIndex((r) => r.nickname.toLowerCase() === q);
  }, [ranking, nickname]);

  const myRow = myIndex >= 0 ? ranking[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;

  useEffect(() => {
    if (!myRow || !ready) return;
    const t = window.setTimeout(() => {
      myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => window.clearTimeout(t);
  }, [myRow, ready, nickname]);

  const top3 = ranked.slice(0, 3);
  const showPodium = top3.some((r) => r.total_points > 0);

  return (
    <div className={embedded ? "" : "public-ranking-page"}>
      {!embedded && (
        <PublicGuestHeader
          nickname={nickname}
          showNicknameModal={showNicknameModal}
          onSaveNickname={saveNickname}
          onOpenEdit={openEdit}
          onCloseEdit={closeEdit}
        />
      )}

      {!embedded ? (
        <div className="public-ranking-hero">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/80">
            Monthly Ranking
          </p>
          <h1 className="text-[1.75rem] font-black mt-1 tracking-tight">{monthLabel}</h1>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant mb-3">
          {venueName} · {monthLabel}
        </p>
      )}

      {prevMonthTop && (
        <section className="public-ranking-king glass-panel rounded-2xl p-4 mb-4">
          <p className="text-[10px] text-on-surface-variant mb-1 uppercase tracking-wider">지난달 1위</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-primary text-xl">emoji_events</span>
              <span className="font-bold truncate">{prevMonthTop.nickname}</span>
              <span className="public-rank-badge public-rank-badge-king shrink-0">KING</span>
            </div>
            <span className="text-sm font-bold text-primary tabular-nums shrink-0">
              {prevMonthTop.total_points.toLocaleString()}점
            </span>
          </div>
        </section>
      )}

      {nickname && (
        <section
          className={`public-ranking-my-card ${myRow ? "public-ranking-my-card-found" : "public-ranking-my-card-empty"}`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-primary">내 랭킹</span>
            <span className="public-rank-badge-me">ME</span>
          </div>
          {myRow && myRank ? (
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-baseline gap-1">
                <p className="text-3xl font-black tabular-nums leading-none">{myRank}</p>
                <span className="text-lg font-bold text-on-surface-variant leading-none pb-0.5">위</span>
              </div>
              <p className="text-2xl font-bold text-primary tabular-nums">
                {myRow.total_points.toLocaleString()}
                <span className="text-sm font-semibold ml-0.5">점</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              &lsquo;{nickname}&rsquo; 닉네임으로 이번 달 랭킹을 찾을 수 없어요.
            </p>
          )}
        </section>
      )}

      {showPodium && <PodiumTop3 top3={top3} nickname={nickname} />}

      <section className="mt-2">
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold">
            전체 순위
            <span className="text-on-surface-variant font-semibold ml-1.5">{ranking.length}명</span>
          </h2>
        </div>

        {ranking.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-on-surface-variant text-sm">
            이번 달 기록이 아직 없습니다.
          </div>
        ) : (
          <div className="space-y-5">
            {SECTIONS.map((section) => {
              const rows = ranked.filter(
                (r) => r.rank >= section.min && r.rank <= section.max,
              );
              if (rows.length === 0) return null;
              return (
                <div key={section.tier}>
                  <div className={`public-ranking-section-head public-ranking-section-${section.tier}`}>
                    {section.label}
                    <span className="public-ranking-section-count">{rows.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {rows.map((item) => (
                      <RankRow
                        key={item.nickname}
                        item={item}
                        isMe={nickname?.trim().toLowerCase() === item.nickname.toLowerCase()}
                        rowRef={myRowRef}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-[10px] text-on-surface-variant/70 text-center mt-8 pb-2">
        승점은 매장 게임 기록 기준 · 매월 1일 갱신
      </p>
    </div>
  );
}
