import type { BlindStructureOption } from "@mnf/timer/types";
import { getSupabase } from "./client";

type RawBlindRow = {
  kind?: "level" | "break";
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

  const { data, error } = await supabase
    .from("game_presets")
    .select(
      "id, name, buy_in, game_kind, buy_in_chips, rebuy1_chips, rebuy2_chips, addon_enabled, addon_chips, bonus_enabled, bonus_chips, blind_structure",
    )
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
      // blind_structure JSONB → BlindLevelDef[]
      // kind 필드가 없는 경우도 처리 (레거시/미입력 데이터 호환)
      // break 레벨은 small=0, big=0 으로 포함 (Next Break 계산에 필요)
      const isBreak = (row: RawBlindRow) =>
        row.kind === "break" || (row.small === 0 && row.big === 0);
      const isLevel = (row: RawBlindRow) =>
        row.kind === "level" || (!row.kind && (row.big ?? 0) > 0);

      // 원본 배열 순서를 유지하며 level 번호 할당
      // 브레이크 행은 직전 플레이 레벨과 다음 레벨 사이 (예: 4 → 4.01 → 5)
      const rawRows = p.blind_structure ?? [];
      let lastPlayLevel = 0;
      let breakSeq = 0;
      const levels = rawRows
        .map((row) => {
          if (isBreak(row)) {
            breakSeq += 1;
            return {
              // 직전 플레이 레벨과 다음 레벨 사이 (4 → 4.01 브레이크 → 5)
              level: Number((lastPlayLevel + breakSeq / 100).toFixed(2)),
              small: 0,
              big: 0,
              ante: 0,
              durationSec: Math.max(1, row.minutes ?? 10) * 60,
            };
          }
          if (!isLevel(row)) return null;
          breakSeq = 0;
          lastPlayLevel = row.level ?? lastPlayLevel + 1;
          return {
            level: lastPlayLevel,
            small: row.small ?? 0,
            big: row.big ?? 0,
            ante: row.ante ?? 0,
            durationSec: Math.max(1, row.minutes ?? 15) * 60,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => a.level - b.level);

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
