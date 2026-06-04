import type { Game, GamePreset } from "@/lib/types";

/** 바인 횟수 = 최초 바인(entry) + 리바인(전 차수 합) */
export function countBuyInEvents(game: Pick<Game, "entry_count" | "rebuy_count">): number {
  return (game.entry_count ?? 0) + (game.rebuy_count ?? 0);
}

export function isPresetAddonEnabled(
  preset: Pick<GamePreset, "addon_enabled" | "addon_price" | "addon_chips"> | null | undefined,
): boolean {
  if (!preset) return false;
  return (
    preset.addon_enabled ?? (preset.addon_price > 0 || preset.addon_chips > 0)
  );
}

/** 애드온 집계 컬럼 도입 전까지 0 (추후 game.addon_count 등 연동) */
export function countAddonEvents(
  _game: Pick<Game, "id">,
): number {
  return 0;
}

export function formatPlayerRatio(
  game: Pick<Game, "survivor_count" | "entry_count">,
): string {
  const total = game.entry_count ?? 0;
  const remaining = game.survivor_count ?? 0;
  return `${remaining} / ${total}`;
}
