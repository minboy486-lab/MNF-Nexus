"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_BINGO_MISSIONS } from "@/lib/events/types";
import { ensureMemberByNickname } from "@/lib/members/ensure-by-nickname";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";

function revalidateBingo() {
  revalidatePath("/admin/scores/bingo");
  revalidatePath("/ranking/bingo");
}

export async function saveBingoCellLabels(monthKey: string, cellLabels: string[]) {
  if (!isSupabaseConfigured()) return { error: "데모 모드에서는 저장할 수 없습니다." };

  const labels = Array.from({ length: 16 }, (_, i) =>
    (cellLabels[i]?.trim() || DEFAULT_BINGO_MISSIONS[i]).slice(0, 80),
  );

  const supabase = await createClient();
  const { error } = await supabase.from("bingo_month_settings").upsert(
    {
      venue_id: DEFAULT_VENUE_ID,
      month_key: monthKey,
      cell_labels: labels,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "venue_id,month_key" },
  );

  if (error) return { error: error.message };
  revalidateBingo();
  return { ok: true as const };
}

export async function addBingoMark(monthKey: string, cellNo: number, nickname: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드에서는 저장할 수 없습니다." };

  const cell = Math.max(1, Math.min(16, Math.round(cellNo)));
  const nick = nickname.trim();
  if (!nick) return { error: "닉네임을 입력하세요." };

  const memberResult = await ensureMemberByNickname(nick);
  if ("error" in memberResult && memberResult.error) return { error: memberResult.error };

  const supabase = await createClient();
  const { error } = await supabase.from("bingo_marks").insert({
    venue_id: DEFAULT_VENUE_ID,
    month_key: monthKey,
    cell_no: cell,
    nickname: memberResult.nickname,
    member_id: memberResult.memberId,
  });

  if (error) {
    if (error.code === "23505") return { error: "이미 해당 칸에 등록된 닉네임입니다." };
    return { error: error.message };
  }

  revalidateBingo();
  return { ok: true as const };
}

export async function removeBingoMark(markId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드에서는 저장할 수 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bingo_marks")
    .delete()
    .eq("id", markId)
    .eq("venue_id", DEFAULT_VENUE_ID);

  if (error) return { error: error.message };
  revalidateBingo();
  return { ok: true as const };
}
