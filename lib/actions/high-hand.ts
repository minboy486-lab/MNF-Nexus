"use server";

import { revalidatePath } from "next/cache";
import {
  HIGH_HAND_BINGO_CELL_NO,
  HIGH_HAND_TYPES,
  monthKeyFromPlayDate,
  type HighHandType,
} from "@/lib/events/types";
import { ensureMemberByNickname } from "@/lib/members/ensure-by-nickname";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";

function handMp(handType: HighHandType): number {
  return HIGH_HAND_TYPES.find((h) => h.id === handType)?.mp ?? 0;
}

function revalidateHighHand() {
  revalidatePath("/admin/scores/highhand");
  revalidatePath("/ranking/highhand");
  revalidatePath("/admin/scores/bingo");
  revalidatePath("/ranking/bingo");
}

async function syncHighHandToBingo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playDate: string,
  nickname: string,
  memberId: string | null,
) {
  await supabase.from("bingo_marks").upsert(
    {
      venue_id: DEFAULT_VENUE_ID,
      month_key: monthKeyFromPlayDate(playDate),
      cell_no: HIGH_HAND_BINGO_CELL_NO,
      nickname,
      member_id: memberId,
    },
    { onConflict: "venue_id,month_key,cell_no,nickname", ignoreDuplicates: true },
  );
}

export async function saveHighHand(input: {
  playDate: string;
  handType: HighHandType;
  nickname: string;
  note?: string;
}) {
  if (!isSupabaseConfigured()) return { error: "데모 모드에서는 저장할 수 없습니다." };

  const playDate = input.playDate.trim();
  const nick = input.nickname.trim();
  if (!playDate) return { error: "날짜를 선택하세요." };
  if (!nick) return { error: "닉네임을 입력하세요." };

  const memberResult = await ensureMemberByNickname(nick);
  if ("error" in memberResult && memberResult.error) return { error: memberResult.error };

  const supabase = await createClient();
  const { error } = await supabase.from("high_hand_daily").upsert(
    {
      venue_id: DEFAULT_VENUE_ID,
      play_date: playDate,
      hand_type: input.handType,
      nickname: memberResult.nickname,
      member_id: memberResult.memberId,
      mp_points: handMp(input.handType),
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "venue_id,play_date,hand_type" },
  );

  if (error) return { error: error.message };

  await syncHighHandToBingo(supabase, playDate, memberResult.nickname, memberResult.memberId);

  revalidateHighHand();
  return { ok: true as const };
}

export async function clearHighHand(playDate: string, handType: HighHandType) {
  if (!isSupabaseConfigured()) return { error: "데모 모드에서는 저장할 수 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("high_hand_daily")
    .delete()
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("play_date", playDate)
    .eq("hand_type", handType);

  if (error) return { error: error.message };
  revalidateHighHand();
  return { ok: true as const };
}
