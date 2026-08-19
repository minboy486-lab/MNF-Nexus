import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BlindStructureOption } from "@mnf/timer/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");

/** .env에서 값 직접 읽기 */
function readEnvFile(): Record<string, string> {
  const candidates = [
    path.resolve(__dirname, "../../.env"),        // out/main → timer-desktop/.env  (prod)
    path.resolve(__dirname, "../../../.env"),      // 더 깊은 경우
    path.resolve(__dirname, "../../../../.env"),   // dev: src/main → timer-desktop/.env
    path.resolve(process.cwd(), ".env"),           // cwd 기준 (npm run dev 시 timer-desktop/)
    path.resolve(process.cwd(), "timer-desktop/.env"), // cwd가 monorepo root인 경우
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const env: Record<string, string> = {};
      for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const idx = t.indexOf("=");
        if (idx < 0) continue;
        const k = t.slice(0, idx).trim();
        const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        env[k] = v;
      }
      console.log("[blinds] .env 로드 성공:", p);
      return env;
    } catch (e) {
      console.warn("[blinds] .env 읽기 실패:", p, e);
    }
  }
  console.warn("[blinds] .env 없음, 검색:", candidates);
  return {};
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  // 매번 새로 시도 (null 캐시 방지)
  const env = readEnvFile();
  const url = (process.env.SUPABASE_URL || env["SUPABASE_URL"] || "").trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env.SUPABASE_ANON_KEY ||
    env["SUPABASE_ANON_KEY"] ||
    ""
  ).trim();

  console.log("[blinds] getClient — URL:", url ? url.slice(0, 30) + "..." : "MISSING", "KEY:", key ? "OK" : "MISSING");

  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

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
  const supabase = getClient();
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
      // 브레이크 행은 level 필드가 없으므로 원본 index 기반으로 소수 level 부여 (ex: 4.5)
      const rawRows = p.blind_structure ?? [];
      const levels = rawRows
        .map((row, rawIdx) => {
          if (isBreak(row)) {
            return {
              level: rawIdx + 0.5, // 앞 레벨과 뒤 레벨 사이에 위치
              small: 0,
              big: 0,
              ante: 0,
              durationSec: Math.max(1, row.minutes ?? 10) * 60,
            };
          }
          if (!isLevel(row)) return null;
          return {
            level: row.level ?? rawIdx + 1,
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
