import type { BlindStructureOption } from "@mnf/timer/types";
import { levelsFromPresetRows } from "@mnf/timer/levels";
import { getSupabase } from "./client";
import { getConfiguredVenueId } from "./venue";

type RawBlindRow = {
  kind?: "level" | "break" | "reg-close";
  level?: number;
  small?: number;
  big?: number;
  ante?: number;
  minutes?: number;
};

type RawPreset = {
  id: string;
  name: string;
  buy_in: number;
  game_kind: string;
  buy_in_chips: number;
  rebuy1_chips: number | null;
  rebuy2_chips: number | null;
  addon_enabled: boolean;
  addon_chips: number;
  bonus_enabled: boolean;
  bonus_chips: number;
  blind_structure: RawBlindRow[] | null;
};

export async function listBlindStructures(): Promise<BlindStructureOption[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("[blinds] Supabase 클라이언트 없음 (env 미설정)");
  }

  const venueId = getConfiguredVenueId();
  const { data, error } = await supabase
    .from("game_presets")
    .select(
      "id, name, buy_in, game_kind, buy_in_chips, rebuy1_chips, rebuy2_chips, addon_enabled, addon_chips, bonus_enabled, bonus_chips, blind_structure",
    )
    .eq("venue_id", venueId)
    .order("name");

  if (error) {
    throw new Error(`[blinds] game_presets 로드 에러: ${error.message}`);
  }
  if (!data?.length) {
    throw new Error("[blinds] game_presets 결과 없음");
  }

  console.log(`[blinds] game_presets ${data.length}개 로드 성공`);

  const options: BlindStructureOption[] = (data as RawPreset[])
    .map((p) => {
      const levels = levelsFromPresetRows(
        (p.blind_structure ?? []).map((row) => ({
          level: row.level ?? 0,
          small: row.small ?? 0,
          big: row.big ?? 0,
          ante: row.ante ?? 0,
          minutes: row.minutes ?? 15,
          kind: row.kind,
        })),
      );

      if (levels.length === 0) return null;

      const rebuyChips: number[] = [];
      if ((p.rebuy1_chips ?? 0) > 0) rebuyChips.push(p.rebuy1_chips!);
      if ((p.rebuy2_chips ?? 0) > 0) rebuyChips.push(p.rebuy2_chips!);

      return {
        id: p.id,
        name: p.name,
        defaultBuyIn: p.buy_in,
        levels,
        isChampionship: p.game_kind === "tournament",
        entryChip: p.buy_in_chips ?? 0,
        rebuyChips,
        rebuyCount: rebuyChips.length,
        hasAddon: p.addon_enabled ?? false,
        addonChip: p.addon_chips ?? 0,
        hasBonusChip: p.bonus_enabled ?? false,
        bonusChipAmount: p.bonus_chips ?? 0,
      } satisfies BlindStructureOption;
    })
    .filter((o): o is BlindStructureOption => o !== null);

  if (options.length === 0) throw new Error("[blinds] 파싱된 레벨 없음");
  return options;
}
