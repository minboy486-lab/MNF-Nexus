"use client";

import { countPlayLevels, normalizeStructure } from "@/lib/presets/structure";
import {
  getPresetBuyInChips,
  getPresetParticipationPoints,
  getPresetPlacements,
  getPresetRebuyChips,
  getPresetWinPoints,
} from "@/lib/presets/preset-form";
import { formatChips } from "@/lib/utils/format";
import { formatMp } from "@/lib/utils/mp";
import type { BlindStructureRow, GamePreset } from "@/lib/types";

type Props = {
  preset: GamePreset;
  onEdit: () => void;
  onDelete: () => void;
  deletePending?: boolean;
};

function kindLabel(kind: GamePreset["game_kind"]) {
  return kind === "tournament" ? "대회" : "데일리";
}

function VerticalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-on-surface-variant shrink-0">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-right">{value}</span>
    </div>
  );
}

function RankReadOnly({
  title,
  empty,
  children,
  headerRight,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant shrink-0">
          {title}
        </h3>
        {headerRight}
      </div>
      {empty ? (
        <p className="text-sm text-on-surface-variant">설정 없음</p>
      ) : (
        <ul className="space-y-1 flex-1">{children}</ul>
      )}
    </div>
  );
}

function StructureTable({ rows }: { rows: BlindStructureRow[] }) {
  const normalized = normalizeStructure(rows);
  if (normalized.length === 0) {
    return <p className="text-sm text-on-surface-variant">레벨 없음</p>;
  }

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden text-xs">
      <div className="grid grid-cols-[2rem_1fr_1fr_1fr_3rem] gap-1 px-2 py-1.5 text-[10px] font-semibold uppercase text-on-surface-variant/80 border-b border-white/10 bg-surface-container-low/40">
        <span className="text-center">Lv</span>
        <span className="text-center">SB</span>
        <span className="text-center">BB</span>
        <span className="text-center">Ante</span>
        <span className="text-center">분</span>
      </div>
      <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
        {normalized.map((row, i) =>
          row.kind === "break" ? (
            <div
              key={`b-${i}`}
              className="flex items-center gap-2 px-3 py-2 bg-secondary/5 border-y border-dashed border-secondary/20 text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-base text-secondary">coffee</span>
              <span>쉬는 시간 · {row.minutes}분</span>
            </div>
          ) : (
            <div
              key={`l-${i}`}
              className="grid grid-cols-[2rem_1fr_1fr_1fr_3rem] gap-1 items-center px-2 py-1.5 tabular-nums"
            >
              <span className="text-center font-bold text-primary">{row.level}</span>
              <span className="text-center">{row.small.toLocaleString("ko-KR")}</span>
              <span className="text-center">{row.big.toLocaleString("ko-KR")}</span>
              <span className="text-center">
                {row.ante > 0 ? row.ante.toLocaleString("ko-KR") : "—"}
              </span>
              <span className="text-center">{row.minutes}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export function PresetDetailPanel({
  preset,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const placements = getPresetPlacements(preset);
  const rebuyChips = getPresetRebuyChips(preset);
  const winPoints = getPresetWinPoints(preset);
  const participationPoints = getPresetParticipationPoints(preset);
  const buyInChips = getPresetBuyInChips(preset);
  const levels = countPlayLevels(normalizeStructure(preset.blind_structure));
  const percentSum = placements.reduce((s, p) => s + p.percent, 0);
  const kind = preset.game_kind ?? "daily";

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10 shrink-0">
        <div className="min-w-0">
          <span
            className={`inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mb-2 ${
              kind === "tournament"
                ? "bg-secondary/20 text-secondary"
                : "bg-primary/15 text-primary"
            }`}
          >
            {kindLabel(kind)}
          </span>
          <h2 className="text-lg font-bold truncate">{preset.name}</h2>
          <p className="text-xs text-on-surface-variant mt-1">
            {levels}레벨 · 프라이즈 {placements.length}등 · 승점 {winPoints.length}등
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/15 hover:bg-white/5"
          >
            <span className="material-symbols-outlined text-base">edit</span>
            수정
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deletePending}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-error/30 text-error hover:bg-error/10 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            {deletePending ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-5 min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
          <div className="rounded-xl border border-white/10 bg-surface-container-low/30 px-4 py-1">
            <VerticalStat label="바인비용" value={formatMp(preset.buy_in)} />
            <VerticalStat label="리바인비용" value={formatMp(preset.rebuy_cost ?? 0)} />
            {(preset.addon_enabled ||
              preset.addon_price > 0 ||
              preset.addon_chips > 0) && (
              <VerticalStat label="애드온비용" value={formatMp(preset.addon_price ?? 0)} />
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-surface-container-low/30 px-4 py-1">
            <VerticalStat label="바인칩" value={formatChips(buyInChips)} />
            {rebuyChips.map((tier) => (
              <VerticalStat
                key={tier.order}
                label={`${tier.order}차리바인칩`}
                value={formatChips(tier.chips)}
              />
            ))}
            {(preset.addon_enabled ||
              preset.addon_price > 0 ||
              preset.addon_chips > 0) && (
              <VerticalStat label="애드온칩" value={formatChips(preset.addon_chips ?? 0)} />
            )}
            {(preset.bonus_enabled || (preset.bonus_chips ?? 0) > 0) && (
              <VerticalStat label="보너스칩" value={formatChips(preset.bonus_chips ?? 0)} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <RankReadOnly
            title="프라이즈"
            empty={placements.length === 0}
            headerRight={
              <span className="text-[10px] text-on-surface-variant tabular-nums whitespace-nowrap">
                프라이즈 풀{" "}
                <span className="text-primary font-semibold">
                  {preset.prize_pool_percent ?? 100}%
                </span>
              </span>
            }
          >
            {placements.map((p) => (
              <li
                key={p.rank}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-white/8 bg-surface-container-low/40"
              >
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-surface-container-high text-xs font-bold tabular-nums shrink-0">
                  {p.rank}
                </span>
                <span className="flex-1 text-on-surface-variant text-xs">등</span>
                <span className="tabular-nums text-primary font-semibold">{p.percent}%</span>
              </li>
            ))}
            {percentSum > 100 && placements.length > 0 && (
              <li className="text-xs text-error font-medium px-1 pt-1">
                등수별 합계 {percentSum}% (100% 초과)
              </li>
            )}
          </RankReadOnly>

          <RankReadOnly
            title="승점"
            empty={winPoints.length === 0 && participationPoints === 0}
            headerRight={
              <span className="text-[10px] text-on-surface-variant tabular-nums whitespace-nowrap">
                참여{" "}
                <span className="text-secondary font-semibold">
                  {participationPoints.toLocaleString("ko-KR")}점
                </span>
              </span>
            }
          >
            {winPoints.map((p) => (
              <li
                key={p.rank}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-white/8 bg-surface-container-low/40"
              >
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-surface-container-high text-xs font-bold tabular-nums shrink-0">
                  {p.rank}
                </span>
                <span className="flex-1 text-on-surface-variant text-xs">등</span>
                <span className="tabular-nums text-secondary font-semibold">
                  {p.points.toLocaleString("ko-KR")}점
                </span>
              </li>
            ))}
          </RankReadOnly>
        </div>

        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2">
            블라인드 구조
          </h3>
          <StructureTable rows={preset.blind_structure} />
        </section>
      </div>
    </div>
  );
}
