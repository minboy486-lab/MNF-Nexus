"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  toggleClock,
  closeRegistration,
  addTableToGame,
  advanceBlindLevel,
  syncClockRemaining,
} from "@/lib/actions/games";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { GameWithRelations, PhysicalTable } from "@/lib/types";
import { formatTimer, formatChips } from "@/lib/utils/format";
import { SPLIT_ORDER } from "@/lib/constants";
import type { PhysicalTableCode } from "@/lib/constants";
import { BlindUpSound } from "@/components/games/BlindUpSound";
import { KakaoShareButton } from "@/components/games/KakaoShareButton";

type Props = {
  game: GameWithRelations;
  allTables: PhysicalTable[];
  totalChips: number;
  avgChips: number;
};

export function GameLiveClient({ game: initialGame, allTables, totalChips, avgChips }: Props) {
  const router = useRouter();
  const clock = Array.isArray(initialGame.game_clocks)
    ? initialGame.game_clocks[0]
    : initialGame.game_clocks;

  const [remaining, setRemaining] = useState(clock?.remaining_seconds ?? 0);
  const [running, setRunning] = useState(clock?.is_running ?? false);
  const [level, setLevel] = useState(clock?.level ?? 1);
  const [warn30, setWarn30] = useState(false);
  const [blindUpSound, setBlindUpSound] = useState(false);

  const assignedIds = new Set(
    initialGame.game_table_assignments.map((a) => a.physical_table_id),
  );
  const availableForMtt = allTables.filter((t) => !assignedIds.has(t.id));
  const tableCodes = initialGame.game_table_assignments.map(
    (a) => a.physical_tables?.code ?? "?",
  );

  const syncToServer = useCallback(
    async (secs: number) => {
      if (isSupabaseConfigured() && running) {
        await syncClockRemaining(initialGame.id, secs);
      }
    },
    [initialGame.id, running],
  );

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = Math.max(0, r - 1);
        if (next === 30) setWarn30(true);
        if (next === 0) {
          setBlindUpSound(true);
          advanceBlindLevel(initialGame.id).then(() => router.refresh());
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, remaining, initialGame.id, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (running) syncToServer(remaining);
    }, 15000);
    return () => clearInterval(interval);
  }, [running, remaining, syncToServer]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`game-${initialGame.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_clocks", filter: `game_id=eq.${initialGame.id}` },
        (payload) => {
          const row = payload.new as {
            remaining_seconds?: number;
            is_running?: boolean;
            level?: number;
          };
          if (row.remaining_seconds != null) setRemaining(row.remaining_seconds);
          if (row.is_running != null) setRunning(row.is_running);
          if (row.level != null) setLevel(row.level);
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialGame.id, router]);

  async function handleToggleClock() {
    const next = !running;
    setRunning(next);
    await toggleClock(initialGame.id, next);
    await syncClockRemaining(initialGame.id, remaining);
    router.refresh();
  }

  async function handleCloseReg() {
    await closeRegistration(initialGame.id);
    router.refresh();
  }

  async function handleAddTable(tableId: string) {
    await addTableToGame(initialGame.id, tableId);
    router.refresh();
  }

  async function handleNextLevel() {
    const result = await advanceBlindLevel(initialGame.id);
    if (result?.error) alert(result.error);
    else {
      setBlindUpSound(true);
      router.refresh();
    }
  }

  const blinds = `${clock?.blind_small?.toLocaleString() ?? 0} / ${clock?.blind_big?.toLocaleString() ?? 0}`;

  return (
    <div className="space-y-8">
      <BlindUpSound play={blindUpSound} onPlayed={() => setBlindUpSound(false)} />
      {warn30 && remaining <= 30 && remaining > 0 && (
        <div className="rounded-lg border border-tertiary/50 bg-tertiary/10 px-4 py-2 text-tertiary text-sm font-bold animate-pulse">
          30초 후 블라인드 업
        </div>
      )}

      {initialGame.button_seat && (
        <p className="text-sm text-primary">
          버튼 Seat: <strong>{initialGame.button_seat}</strong>
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-6 border-t-2 border-primary/50 col-span-2 card-running">
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-semibold mb-2">
            Level {level}
          </p>
          <p className="stat-display text-6xl md:text-8xl text-primary text-glow-primary tabular-nums">
            {formatTimer(remaining)}
          </p>
          <p className="stat-display text-xl text-tertiary text-glow-tertiary mt-3">
            {clock?.blind_small?.toLocaleString()} / {clock?.blind_big?.toLocaleString()}
            {clock?.ante ? ` · Ante ${clock.ante.toLocaleString()}` : ""}
          </p>
        </div>
        <div className="glass-panel rounded-2xl p-5 border-t-2 border-secondary/50">
          <p className="text-[10px] uppercase tracking-[0.15em] text-on-surface-variant font-semibold">생존 / 엔트리</p>
          <p className="stat-display stat-display-xl text-secondary text-glow-secondary mt-1">
            {initialGame.survivor_count}
            <span className="text-on-surface-variant/50 text-2xl">/</span>
            {initialGame.entry_count}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">리바인 {initialGame.rebuy_count}</p>
        </div>
        <div className="glass-panel rounded-2xl p-5 border-t-2 border-primary/50">
          <p className="text-[10px] uppercase tracking-[0.15em] text-on-surface-variant font-semibold">총 칩 · 평균</p>
          <p className="stat-display stat-display-lg text-primary text-glow-primary mt-1">{formatChips(totalChips)}</p>
          <p className="stat-display text-lg text-tertiary text-glow-tertiary mt-0.5">avg {formatChips(avgChips)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/games/${initialGame.id}/settlement`}
          className="px-5 py-2 rounded-lg border border-tertiary text-tertiary font-bold"
        >
          프라이즈 · ICM
        </Link>
        <button
          type="button"
          onClick={handleToggleClock}
          className="btn-primary px-5 py-2 rounded-lg text-sm"
        >
          {running ? "일시정지" : "타이머 시작"}
        </button>
        <button
          type="button"
          onClick={handleNextLevel}
          className="px-5 py-2 rounded-lg border border-secondary text-secondary font-bold"
        >
          다음 레벨
        </button>
        {!initialGame.registration_closed && (
          <button
            type="button"
            onClick={handleCloseReg}
            className="px-5 py-2 rounded-lg border border-primary text-primary font-bold"
          >
            레지 마감
          </button>
        )}
        {initialGame.registration_closed && (
          <span className="px-3 py-2 text-sm text-error border border-error/30 rounded-lg">
            레지 마감됨 — 리바인은 수동만 가능
          </span>
        )}
        <KakaoShareButton
          gameName={`데일리 #${initialGame.daily_game_number ?? ""}`}
          tableCodes={tableCodes}
          level={level}
          blinds={blinds}
          remaining={formatTimer(remaining)}
          survivors={initialGame.survivor_count}
          entries={initialGame.entry_count}
          rebuyCount={initialGame.rebuy_count}
        />
      </div>

      <section>
        <h2 className="font-bold mb-3">연결된 물리 테이블</h2>
        <div className="flex flex-wrap gap-2">
          {initialGame.game_table_assignments.map((a) => (
            <Link
              key={a.id}
              href={`/admin/tables/${a.physical_table_id}`}
              className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary font-bold"
            >
              {a.physical_tables?.code ?? "?"}
            </Link>
          ))}
        </div>
      </section>

      {availableForMtt.length > 0 && (
        <section className="glass-panel rounded-xl p-5 border border-tertiary/30">
          <h2 className="font-bold text-tertiary mb-2">멀티테이블 전환</h2>
          <p className="text-sm text-on-surface-variant mb-3">
            권장 분할 순서: {SPLIT_ORDER.join(" → ")} (수동 선택)
          </p>
          <div className="flex flex-wrap gap-2">
            {[...availableForMtt]
              .sort(
                (a, b) =>
                  SPLIT_ORDER.indexOf(a.code as PhysicalTableCode) -
                  SPLIT_ORDER.indexOf(b.code as PhysicalTableCode),
              )
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleAddTable(t.id)}
                  className="px-4 py-2 rounded-lg bg-tertiary/20 border border-tertiary/40 hover:bg-tertiary/30"
                >
                  + 테이블 {t.code}
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
