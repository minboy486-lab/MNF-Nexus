import { getGamePresets } from "@/lib/data/queries";
import { PresetsClient } from "@/components/presets/PresetsClient";
import {
  getPresetBuyInChips,
  getPresetParticipationPoints,
  getPresetRebuyChips,
} from "@/lib/presets/preset-form";
import { normalizeStructure } from "@/lib/presets/structure";
import type { GamePreset } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PresetsPage() {
  const raw = await getGamePresets();
  const presets: GamePreset[] = raw.map((p) => {
    const base = {
      ...p,
      game_kind: p.game_kind ?? "daily",
      rebuy_cost: p.rebuy_cost ?? 0,
      addon_enabled: p.addon_enabled ?? (p.addon_price > 0 || p.addon_chips > 0),
      addon_price: p.addon_price ?? 0,
      rebuy1_chips: p.rebuy1_chips ?? 0,
      rebuy2_chips: p.rebuy2_chips ?? 0,
      addon_chips: p.addon_chips ?? 0,
      bonus_enabled: p.bonus_enabled ?? (p.bonus_chips ?? 0) > 0,
      bonus_chips: p.bonus_chips ?? 0,
      prize_pool_percent: p.prize_pool_percent ?? 100,
      blind_structure: normalizeStructure(p.blind_structure),
      prize_rules: p.prize_rules ?? null,
      rebuy_chips: [] as GamePreset["rebuy_chips"],
    } as GamePreset;
    return {
      ...base,
      buy_in_chips: getPresetBuyInChips(base),
      participation_points: getPresetParticipationPoints(base),
      rebuy_chips: getPresetRebuyChips(base),
    };
  });

  return <PresetsClient presets={presets} />;
}
