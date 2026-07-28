"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScoreRankingRow } from "@/lib/scores/types";

const NICKNAME_KEY = "mnf-guest-ranking-nickname";

type Props = {
  ranking: ScoreRankingRow[];
  prevMonthTop: ScoreRankingRow | null;
  monthLabel: string;
};

function rankTier(rank: number): { label: string; className: string } | null {
  if (rank <= 5) return { label: "TOP 5", className: "public-rank-badge-top" };
  if (rank <= 40) return { label: "6~40위", className: "public-rank-badge-mid" };
  return null;
}

function NicknameModal({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (nick: string) => void;
  onClose?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nick = value.trim();
    if (!nick) return;
    onSave(nick);
  }

  return (
    <div className="public-ranking-modal-backdrop" role="dialog" aria-modal="true">
      <div className="public-ranking-modal">
        <h2 className="text-lg font-bold text-center mb-1">닉네임 설정</h2>
        <p className="text-xs text-on-surface-variant text-center mb-5">
          매장에서 사용하는 닉네임을 입력하세요
        </p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs text-on-surface-variant">
            닉네임
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="닉네임을 입력하세요"
              className="login-input w-full mt-1.5 text-base py-3"
              autoComplete="nickname"
              maxLength={32}
            />
          </label>
          <div className="flex gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-white/15 text-sm font-semibold text-on-surface-variant hover:bg-white/5"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex-1 btn-primary py-3 rounded-xl text-sm font-bold disabled:opacity-40"
            >
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RankRow({
  rank,
  row,
  isMe,
  rowRef,
}: {
  rank: number;
  row: ScoreRankingRow;
  isMe: boolean;
  rowRef?: React.RefObject<HTMLLIElement | null>;
}) {
  const tier = rankTier(rank);
  const topFive = rank <= 5;

  return (
    <li
      ref={isMe ? rowRef : undefined}
      className={`public-ranking-row ${isMe ? "public-ranking-row-me" : ""} ${topFive ? "public-ranking-row-top" : ""}`}
    >
      <div
        className={`public-ranking-rank-num ${topFive ? "public-ranking-rank-num-top" : "public-ranking-rank-num-default"}`}
      >
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold truncate">{row.nickname}</span>
          {isMe && <span className="public-rank-badge-me">ME</span>}
          {tier && <span className={`public-rank-badge ${tier.className}`}>{tier.label}</span>}
        </div>
        <p className="text-[10px] text-on-surface-variant mt-0.5">
          출석 {row.visit_days}일
        </p>
      </div>
      <div className="public-ranking-points">
        <span className="tabular-nums font-bold">{row.total_points.toLocaleString()}</span>
        <span className="text-[10px] text-on-surface-variant ml-0.5">점</span>
      </div>
    </li>
  );
}

export function PublicRankingClient({ ranking, prevMonthTop, monthLabel }: Props) {
  const [nickname, setNickname] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const myRowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(NICKNAME_KEY);
    if (saved) setNickname(saved);
    setReady(true);
  }, []);

  const saveNickname = useCallback((nick: string) => {
    localStorage.setItem(NICKNAME_KEY, nick);
    setNickname(nick);
    setEditOpen(false);
  }, []);

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

  const showSetup = ready && !nickname && !editOpen;
  const showEdit = editOpen;

  return (
    <div className="public-ranking-page">
      {(showSetup || showEdit) && (
        <NicknameModal
          initial={nickname ?? ""}
          onSave={saveNickname}
          onClose={nickname ? () => setEditOpen(false) : undefined}
        />
      )}

      <header className="public-ranking-header">
        <div className="flex items-center gap-2 min-w-0">
          <span className="public-ranking-logo">MNF</span>
          <span className="font-bold text-sm bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent truncate">
            HOLDEM
          </span>
        </div>
        {nickname ? (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="text-sm font-semibold text-primary truncate max-w-[40%] hover:underline"
          >
            {nickname}
          </button>
        ) : (
          <span className="text-xs text-on-surface-variant">닉네임 미설정</span>
        )}
      </header>

      <div className="public-ranking-hero">
        <p className="text-xs text-on-surface-variant tracking-wide">월별 랭킹</p>
        <h1 className="text-2xl font-bold mt-0.5">{monthLabel}</h1>
      </div>

      {prevMonthTop && (
        <section className="public-ranking-king glass-panel rounded-2xl p-4 mb-4">
          <p className="text-[10px] text-on-surface-variant mb-1">지난달 1위</p>
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
        <section className={`public-ranking-my-card ${myRow ? "public-ranking-my-card-found" : "public-ranking-my-card-empty"}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-emerald-300/90">내 랭킹</span>
            <span className="public-rank-badge-me">ME</span>
          </div>
          {myRow && myRank ? (
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-black tabular-nums leading-none">{myRank}</p>
                <p className="text-xs text-on-surface-variant mt-1">위 · 출석 {myRow.visit_days}일</p>
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

      <section className="mt-4">
        <h2 className="text-xs font-semibold text-on-surface-variant mb-2 px-0.5">
          전체 순위 · {ranking.length}명
        </h2>
        {ranking.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-on-surface-variant text-sm">
            이번 달 기록이 아직 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {ranking.map((row, i) => (
              <RankRow
                key={row.nickname}
                rank={i + 1}
                row={row}
                isMe={nickname?.trim().toLowerCase() === row.nickname.toLowerCase()}
                rowRef={myRowRef}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="text-[10px] text-on-surface-variant/70 text-center mt-8 pb-4">
        승점은 매장 게임 기록 기준 · 매월 1일 갱신
      </p>
    </div>
  );
}
