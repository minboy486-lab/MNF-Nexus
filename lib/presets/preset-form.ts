import { normalizeStructure } from "@/lib/presets/structure";
import type {
  GamePreset,
  PresetPrizeRules,
  PrizePlacement,
  RebuyChipTier,
  WinPointPlacement,
} from "@/lib/types";

export function renumberRanks<T extends { rank: number }>(rows: T[]): T[] {
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function getPresetPlacements(preset: GamePreset): PrizePlacement[] {
  const rules = preset.prize_rules;
  if (rules && typeof rules === "object" && "placements" in rules) {
    return renumberRanks([...((rules as PresetPrizeRules).placements ?? [])]);
  }
  return [];
}

export function renumberRebuyOrders(rows: RebuyChipTier[]): RebuyChipTier[] {
  return rows.map((row, i) => ({ ...row, order: i + 1 }));
}

function getRules(preset: GamePreset): PresetPrizeRules | null {
  const rules = preset.prize_rules;
  if (!rules || typeof rules !== "object") return null;
  return rules as PresetPrizeRules;
}

export function getPresetRebuyChips(preset: GamePreset): RebuyChipTier[] {
  const raw = preset.rebuy_chips;
  if (Array.isArray(raw) && raw.length > 0) {
    return renumberRebuyOrders(
      raw.map((r) => ({
        order: Number((r as RebuyChipTier).order) || 1,
        chips: Number((r as RebuyChipTier).chips) || 0,
      })),
    );
  }
  const fromRules = getRules(preset)?.rebuy_chips;
  if (Array.isArray(fromRules) && fromRules.length > 0) {
    return renumberRebuyOrders(
      fromRules.map((r) => ({
        order: Number(r.order) || 1,
        chips: Number(r.chips) || 0,
      })),
    );
  }
  const tiers: RebuyChipTier[] = [{ order: 1, chips: preset.rebuy1_chips ?? 0 }];
  if ((preset.rebuy2_chips ?? 0) > 0) {
    tiers.push({ order: 2, chips: preset.rebuy2_chips });
  }
  return tiers;
}

export function getPresetParticipationPoints(preset: GamePreset): number {
  const rules = getRules(preset);
  if (rules?.participation_points != null) {
    return rules.participation_points;
  }
  return preset.participation_points ?? 0;
}

export function getPresetBuyInChips(preset: GamePreset): number {
  const rules = getRules(preset);
  if (rules?.buy_in_chips != null && rules.buy_in_chips > 0) {
    return rules.buy_in_chips;
  }
  return preset.buy_in_chips ?? 0;
}

export function getPresetWinPoints(preset: GamePreset): WinPointPlacement[] {
  const rules = preset.prize_rules;
  if (rules && typeof rules === "object" && "win_points" in rules) {
    return renumberRanks([...((rules as PresetPrizeRules).win_points ?? [])]);
  }
  return [];
}

export function presetToFormState(preset: GamePreset) {
  const placements = getPresetPlacements(preset);
  const winPoints = getPresetWinPoints(preset);
  return {
    gameKind: preset.game_kind ?? "daily",
    name: preset.name,
    buyIn: preset.buy_in,
    rebuyCost: preset.rebuy_cost ?? 0,
    addonEnabled:
      preset.addon_enabled ??
      (preset.addon_price > 0 || preset.addon_chips > 0),
    addonPrice: preset.addon_price ?? 0,
    buyInChips: getPresetBuyInChips(preset),
    rebuyChips: getPresetRebuyChips(preset),
    addonChips: preset.addon_chips ?? 0,
    bonusEnabled:
      preset.bonus_enabled ?? (preset.bonus_chips ?? 0) > 0,
    bonusChips: preset.bonus_chips ?? 0,
    participationPoints: getPresetParticipationPoints(preset),
    prizePoolPercent: preset.prize_pool_percent ?? 100,
    placements: placements.length > 0 ? placements : [{ rank: 1, percent: 50 }],
    winPoints: winPoints.length > 0 ? winPoints : [{ rank: 1, points: 100 }],
    structure: normalizeStructure(preset.blind_structure),
  };
}
