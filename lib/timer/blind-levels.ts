import type { BlindLevelDef } from "./types";

/** 기본 블라인드 (Supabase 미연결 시 fallback) */
export const BLIND_LEVELS: BlindLevelDef[] = [
  { level: 1, small: 100, big: 200, ante: 0, durationSec: 20 * 60 },
  { level: 2, small: 200, big: 400, ante: 0, durationSec: 20 * 60 },
  { level: 3, small: 300, big: 600, ante: 100, durationSec: 20 * 60 },
  { level: 4, small: 400, big: 800, ante: 100, durationSec: 20 * 60 },
  { level: 5, small: 500, big: 1_000, ante: 200, durationSec: 20 * 60 },
  { level: 6, small: 600, big: 1_200, ante: 200, durationSec: 20 * 60 },
];

export function getBlindLevel(level: number): BlindLevelDef {
  return BLIND_LEVELS.find((l) => l.level === level) ?? BLIND_LEVELS[BLIND_LEVELS.length - 1];
}

export function getNextBlindLevel(level: number): BlindLevelDef | null {
  return BLIND_LEVELS.find((l) => l.level === level + 1) ?? null;
}

export const FALLBACK_BLIND_STRUCTURES = [
  {
    id: "local-daily",
    name: "데일리 20분",
    defaultBuyIn: 100000,
    levels: BLIND_LEVELS,
    isChampionship: false,
    entryChip: 50000,
    rebuyChips: [50000, 60000],
    rebuyCount: 2,
    hasAddon: true,
    addonChip: 30000,
    hasBonusChip: false,
    bonusChipAmount: 0,
  },
  {
    id: "local-turbo",
    name: "터보 15분",
    defaultBuyIn: 50000,
    levels: BLIND_LEVELS.map((l) => ({ ...l, durationSec: 15 * 60 })),
    isChampionship: false,
    entryChip: 50000,
    rebuyChips: [50000],
    rebuyCount: 1,
    hasAddon: false,
    addonChip: 0,
    hasBonusChip: false,
    bonusChipAmount: 0,
  },
];
