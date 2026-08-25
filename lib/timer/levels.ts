import type { BlindLevelDef, PauseKind, TableTimerState } from "./types";
import { BLIND_LEVELS } from "./blind-levels";

const LEVEL_EPS = 1e-6;

export function resolveLevels(levels: BlindLevelDef[]): BlindLevelDef[] {
  return levels.length > 0 ? levels : BLIND_LEVELS;
}

export function sortedBlindLevels(levels: BlindLevelDef[]): BlindLevelDef[] {
  return resolveLevels(levels).slice().sort((a, b) => a.level - b.level);
}

export function isBreakBlind(def: Pick<BlindLevelDef, "small" | "big">): boolean {
  return def.small === 0 && def.big === 0;
}

export function pauseKindOf(def: BlindLevelDef | null | undefined): PauseKind | null {
  if (!def) return null;
  if (def.pauseKind) return def.pauseKind;
  if (isBreakBlind(def)) return "break";
  return null;
}

export function resolveTimerPauseKind(
  state: Pick<
    TableTimerState,
    "smallBlind" | "bigBlind" | "pauseKind" | "levels" | "blindLevel" | "blindStructureId"
  > | null | undefined,
): PauseKind | null {
  if (!state?.blindStructureId) return null;
  if (!isBreakBlind({ small: state.smallBlind, big: state.bigBlind })) return null;
  if (state.pauseKind) return state.pauseKind;
  return pauseKindOf(getLevelDef(state.levels ?? [], state.blindLevel));
}

export function formatTimerLevelHeadline(
  state: Pick<
    TableTimerState,
    "smallBlind" | "bigBlind" | "pauseKind" | "levels" | "blindLevel" | "blindStructureId"
  > | null | undefined,
): string {
  const kind = resolveTimerPauseKind(state);
  if (kind === "reg-close") return "레지마감";
  if (kind === "break") return "BREAK";
  return `LEVEL ${state?.blindLevel ?? 1}`;
}

export function formatTimerLevelShort(
  state: Pick<
    TableTimerState,
    "smallBlind" | "bigBlind" | "pauseKind" | "levels" | "blindLevel" | "blindStructureId"
  > | null | undefined,
  playPrefix = "Lv",
): string {
  const kind = resolveTimerPauseKind(state);
  if (kind === "reg-close") return "레지마감";
  if (kind === "break") return "BREAK";
  const level = state?.blindLevel ?? 1;
  return playPrefix ? `${playPrefix} ${level}` : String(level);
}

export function formatPauseBanner(kind: PauseKind | null | undefined): string {
  return kind === "reg-close" ? "레지마감" : "BREAK TIME";
}

export function formatNextPauseVal(next: BlindLevelDef): string {
  const min = Math.round(next.durationSec / 60);
  return pauseKindOf(next) === "reg-close" ? `레지마감 (${min}min)` : `BREAK (${min}min)`;
}

export function firstRegCloseLevel(levels: BlindLevelDef[] | undefined): number | null {
  const found = (levels ?? []).find((l) => pauseKindOf(l) === "reg-close");
  return found?.level ?? null;
}

export function hasReachedRegClose(
  timer: Pick<TableTimerState, "blindLevel" | "levels"> | null | undefined,
): boolean {
  if (!timer) return false;
  const at = firstRegCloseLevel(timer.levels);
  return at != null && timer.blindLevel >= at;
}

function sameLevel(a: number, b: number): boolean {
  return Math.abs(a - b) < LEVEL_EPS;
}

export function getLevelDef(levels: BlindLevelDef[], level: number): BlindLevelDef {
  const list = sortedBlindLevels(levels);
  return list.find((l) => sameLevel(l.level, level)) ?? list[list.length - 1];
}

export function getNextLevelDef(levels: BlindLevelDef[], level: number): BlindLevelDef | null {
  const list = sortedBlindLevels(levels);
  const idx = list.findIndex((l) => sameLevel(l.level, level));
  if (idx >= 0) return list[idx + 1] ?? null;
  return list.find((l) => l.level > level) ?? null;
}

export function getPrevLevelDef(levels: BlindLevelDef[], level: number): BlindLevelDef | null {
  const list = sortedBlindLevels(levels);
  const idx = list.findIndex((l) => sameLevel(l.level, level));
  if (idx > 0) return list[idx - 1] ?? null;
  if (idx === 0) return null;
  const earlier = list.filter((l) => l.level < level);
  return earlier[earlier.length - 1] ?? null;
}

function assignBreakLevel(lastPlayLevel: number, breakSeq: number): number {
  return Number((lastPlayLevel + breakSeq / 100).toFixed(2));
}

export function levelsFromStructureRows(
  rows: Array<{
    level_number: number;
    level_kind: string;
    small_blind: number;
    big_blind: number;
    ante: number;
    duration_minutes: number;
  }>,
): BlindLevelDef[] {
  let lastPlayLevel = 0;
  let breakSeq = 0;
  return rows
    .map((row) => {
      const isPause =
        row.level_kind === "break" ||
        row.level_kind === "reg-close" ||
        (row.small_blind === 0 && row.big_blind === 0);
      if (isPause) {
        breakSeq += 1;
        return {
          level: assignBreakLevel(lastPlayLevel, breakSeq),
          small: 0,
          big: 0,
          ante: 0,
          durationSec: Math.max(1, row.duration_minutes) * 60,
          pauseKind: row.level_kind === "reg-close" ? "reg-close" : "break",
        } satisfies BlindLevelDef;
      }
      breakSeq = 0;
      lastPlayLevel = Number.isFinite(row.level_number) ? row.level_number : lastPlayLevel + 1;
      return {
        level: lastPlayLevel,
        small: row.small_blind,
        big: row.big_blind,
        ante: row.ante,
        durationSec: Math.max(1, row.duration_minutes) * 60,
      };
    })
    .sort((a, b) => a.level - b.level);
}

export function levelsFromPresetRows(
  rows: Array<{ level: number; small: number; big: number; ante?: number; minutes: number; kind?: string }>,
): BlindLevelDef[] {
  let lastPlayLevel = 0;
  let breakSeq = 0;
  return rows
    .map((row) => {
      const isPause =
        row.kind === "break" ||
        row.kind === "reg-close" ||
        (row.small === 0 && row.big === 0 && row.kind !== "level");
      if (isPause) {
        breakSeq += 1;
        return {
          level: assignBreakLevel(lastPlayLevel, breakSeq),
          small: 0,
          big: 0,
          ante: 0,
          durationSec: Math.max(1, row.minutes) * 60,
          pauseKind: row.kind === "reg-close" ? "reg-close" : "break",
        } satisfies BlindLevelDef;
      }
      breakSeq = 0;
      lastPlayLevel = Number.isFinite(row.level) ? row.level : lastPlayLevel + 1;
      return {
        level: lastPlayLevel,
        small: row.small,
        big: row.big,
        ante: row.ante ?? 0,
        durationSec: Math.max(1, row.minutes) * 60,
      };
    })
    .sort((a, b) => a.level - b.level);
}
