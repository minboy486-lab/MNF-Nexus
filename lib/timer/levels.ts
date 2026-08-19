import type { BlindLevelDef } from "./types";
import { BLIND_LEVELS } from "./blind-levels";

export function resolveLevels(levels: BlindLevelDef[]): BlindLevelDef[] {
  return levels.length > 0 ? levels : BLIND_LEVELS;
}

export function getLevelDef(levels: BlindLevelDef[], level: number): BlindLevelDef {
  const list = resolveLevels(levels);
  return list.find((l) => l.level === level) ?? list[list.length - 1];
}

export function getNextLevelDef(levels: BlindLevelDef[], level: number): BlindLevelDef | null {
  const list = resolveLevels(levels);
  return list.find((l) => l.level === level + 1) ?? null;
}

export function getPrevLevelDef(levels: BlindLevelDef[], level: number): BlindLevelDef | null {
  const list = resolveLevels(levels);
  return list.find((l) => l.level === level - 1) ?? null;
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
  return rows
    .filter((row) => row.level_kind === "play")
    .map((row) => ({
      level: row.level_number,
      small: row.small_blind,
      big: row.big_blind,
      ante: row.ante,
      durationSec: Math.max(1, row.duration_minutes) * 60,
    }))
    .sort((a, b) => a.level - b.level);
}

export function levelsFromPresetRows(
  rows: Array<{ level: number; small: number; big: number; ante?: number; minutes: number; kind?: string }>,
): BlindLevelDef[] {
  return rows
    .filter((row) => row.kind !== "break")
    .map((row) => ({
      level: row.level,
      small: row.small,
      big: row.big,
      ante: row.ante ?? 0,
      durationSec: Math.max(1, row.minutes) * 60,
    }))
    .sort((a, b) => a.level - b.level);
}
