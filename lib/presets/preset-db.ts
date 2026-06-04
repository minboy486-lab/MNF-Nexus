import type { SupabaseClient } from "@supabase/supabase-js";

const MISSING_COL_RE = /Could not find the '([^']+)' column/;

export function friendlyPresetDbError(message: string): string {
  if (message.includes("row-level security")) {
    return "저장 권한이 없습니다. 관리자 계정으로 로그인했는지 확인하세요.";
  }
  const missing = MISSING_COL_RE.exec(message);
  if (missing) {
    return `DB에 「${missing[1]}」 컬럼이 없습니다. Supabase SQL Editor에서 supabase/migrations 007~013을 적용해 주세요.`;
  }
  return message;
}

/** Strip unknown columns when remote DB is behind local migrations (PGRST204). */
export async function insertGamePresetRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ id: string } | { error: string }> {
  const payload = { ...row };
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await supabase
      .from("game_presets")
      .insert(payload)
      .select("id")
      .single();

    if (!error && data?.id) return { id: data.id };

    const msg = error?.message ?? "저장 실패";
    const col = MISSING_COL_RE.exec(msg)?.[1];
    if (error?.code === "PGRST204" && col && col in payload) {
      delete payload[col];
      continue;
    }
    return { error: friendlyPresetDbError(msg) };
  }
  return { error: "저장에 실패했습니다. DB 스키마를 확인해 주세요." };
}

export async function updateGamePresetRow(
  supabase: SupabaseClient,
  id: string,
  row: Record<string, unknown>,
): Promise<{ success: true } | { error: string }> {
  const payload = { ...row };
  for (let attempt = 0; attempt < 12; attempt++) {
    const { error } = await supabase.from("game_presets").update(payload).eq("id", id);

    if (!error) return { success: true };

    const msg = error?.message ?? "저장 실패";
    const col = MISSING_COL_RE.exec(msg)?.[1];
    if (error?.code === "PGRST204" && col && col in payload) {
      delete payload[col];
      continue;
    }
    return { error: friendlyPresetDbError(msg) };
  }
  return { error: "저장에 실패했습니다. DB 스키마를 확인해 주세요." };
}
