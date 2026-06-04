"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  countAddonEvents,
  countBuyInEvents,
  formatPlayerRatio,
  isPresetAddonEnabled,
} from "@/lib/games/stats";
import { formatTimer } from "@/lib/utils/format";
import type { Game, GameClock, GamePreset } from "@/lib/types";

type Props = {
  game: Game;
  clock: GameClock | null;
  preset: GamePreset | null;
  blindName?: string | null;
};

function HudItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5 shrink-0 min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold whitespace-nowrap">
        {label}
      </span>
      <span
        className={`text-sm font-bold tabular-nums whitespace-nowrap ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function TableGameHudBar({ game, clock, preset, blindName }: Props) {
  const [remaining, setRemaining] = useState(clock?.remaining_seconds ?? 0);
  const running = clock?.is_running ?? false;
  const level = clock?.level ?? 1;
  const sb = clock?.blind_small ?? 0;
  const bb = clock?.blind_big ?? 0;
  const ante = clock?.ante ?? 0;
  const addonEnabled = isPresetAddonEnabled(preset);

  useEffect(() => {
    setRemaining(clock?.remaining_seconds ?? 0);
  }, [clock?.remaining_seconds, clock?.level]);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running, remaining]);

  const blindText =
    ante > 0
      ? `${sb.toLocaleString("ko-KR")} / ${bb.toLocaleString("ko-KR")} (${ante.toLocaleString("ko-KR")})`
      : `${sb.toLocaleString("ko-KR")} / ${bb.toLocaleString("ko-KR")}`;

  return (
    <header className="shrink-0 glass-panel rounded-xl border border-white/10 px-3 py-2 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1.5">
      {blindName && (
        <span
          className="text-xs sm:text-sm font-bold text-secondary truncate max-w-[140px] sm:max-w-none"
          title={blindName}
        >
          {blindName}
        </span>
      )}
      {blindName && <span className="hidden sm:block w-px h-4 bg-white/10 shrink-0" aria-hidden />}
      <HudItem label="레벨" value={`Lv ${level}`} highlight />
      <HudItem label="블라인드" value={blindText} />
      <HudItem
        label="시간"
        value={
          <span className={`inline-flex items-center gap-1 ${running ? "text-secondary" : ""}`}>
            {formatTimer(remaining)}
            {running && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            )}
          </span>
        }
      />
      <span className="hidden sm:block w-px h-4 bg-white/10 shrink-0" aria-hidden />
      <HudItem label="바인 수" value={countBuyInEvents(game)} />
      {addonEnabled && <HudItem label="애드온" value={countAddonEvents(game)} />}
      <HudItem label="Player" value={formatPlayerRatio(game)} />
    </header>
  );
}
