"use server";

import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/auth/password";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";

function revalidateScores() {
  revalidateScores();
  revalidatePath("/ranking");
}

export type AddManualScoreInput = {
  playDate: string;
  gameNo?: number;
  nickname: string;
  buyInPoints: number;
  rebuyPoints: number;
  moneyInPoints: number;
  note?: string;
};

async function ensureMemberByNickname(nickname: string) {
  const nick = nickname.trim();
  if (!nick) return { error: "닉네임을 입력하세요." as const };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("members")
    .select("id, nickname")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("nickname", nick)
    .maybeSingle();

  if (existing) {
    return { memberId: existing.id, nickname: existing.nickname, created: false };
  }

  const loginId = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const passwordHash = await hashPassword("0000");
  const { data, error } = await supabase
    .from("members")
    .insert({
      venue_id: DEFAULT_VENUE_ID,
      login_id: loginId,
      password_hash: passwordHash,
      nickname: nick,
      floor_status: "registered",
    })
    .select("id, nickname")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("members")
        .select("id, nickname")
        .eq("venue_id", DEFAULT_VENUE_ID)
        .eq("nickname", nick)
        .maybeSingle();
      if (retry) return { memberId: retry.id, nickname: retry.nickname, created: false };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/guests");
  return { memberId: data.id, nickname: data.nickname, created: true };
}

export async function addManualScore(input: AddManualScoreInput) {
  if (!isSupabaseConfigured()) return { error: "데모 모드에서는 저장할 수 없습니다." };

  const playDate = input.playDate.trim();
  const gameNo = Math.max(1, Math.round(input.gameNo ?? 1));
  const buyIn = Math.max(0, Math.round(input.buyInPoints || 0));
  const rebuy = Math.max(0, Math.round(input.rebuyPoints || 0));
  const moneyIn = Math.max(0, Math.round(input.moneyInPoints || 0));

  if (!playDate) return { error: "날짜를 선택하세요." };
  if (buyIn + rebuy + moneyIn === 0) return { error: "점수를 1 이상 입력하세요." };

  const memberResult = await ensureMemberByNickname(input.nickname);
  if ("error" in memberResult && memberResult.error) return { error: memberResult.error };

  const supabase = await createClient();
  const nickname = memberResult.nickname;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("manual_score_daily")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("play_date", playDate)
    .eq("game_no", gameNo)
    .eq("nickname", nickname)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("manual_score_daily")
      .update({
        buy_in_points: existing.buy_in_points + buyIn,
        rebuy_points: existing.rebuy_points + rebuy,
        money_in_points: existing.money_in_points + moneyIn,
        member_id: memberResult.memberId,
        note: input.note?.trim() || existing.note,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("manual_score_daily").insert({
      venue_id: DEFAULT_VENUE_ID,
      member_id: memberResult.memberId,
      play_date: playDate,
      game_no: gameNo,
      nickname,
      buy_in_points: buyIn,
      rebuy_points: rebuy,
      money_in_points: moneyIn,
      note: input.note?.trim() || null,
    });

    if (error) return { error: error.message };
  }

  revalidateScores();
  return {
    success: true,
    memberCreated: memberResult.created,
    nickname,
  };
}

/** 시트 입력: 같은 날·게임·닉네임 행을 절대값으로 덮어씀 (자동 저장용) */
export async function setManualScoreRow(input: AddManualScoreInput) {
  if (!isSupabaseConfigured()) return { error: "데모 모드에서는 저장할 수 없습니다." };

  const playDate = input.playDate.trim();
  const gameNo = Math.max(1, Math.round(input.gameNo ?? 1));
  const buyIn = Math.max(0, Math.round(input.buyInPoints || 0));
  const rebuy = Math.max(0, Math.round(input.rebuyPoints || 0));
  const moneyIn = Math.max(0, Math.round(input.moneyInPoints || 0));

  if (!playDate) return { error: "날짜를 선택하세요." };
  if (buyIn + rebuy + moneyIn === 0) return { error: "점수를 1 이상 입력하세요." };

  const memberResult = await ensureMemberByNickname(input.nickname);
  if ("error" in memberResult && memberResult.error) return { error: memberResult.error };

  const supabase = await createClient();
  const nickname = memberResult.nickname;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("manual_score_daily")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("play_date", playDate)
    .eq("game_no", gameNo)
    .eq("nickname", nickname)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("manual_score_daily")
      .update({
        buy_in_points: buyIn,
        rebuy_points: rebuy,
        money_in_points: moneyIn,
        member_id: memberResult.memberId,
        note: input.note?.trim() || existing.note,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (error) return { error: error.message };

    revalidateScores();
    return {
      success: true,
      memberCreated: memberResult.created,
      nickname,
      recordId: existing.id,
    };
  }

  const { data, error } = await supabase
    .from("manual_score_daily")
    .insert({
      venue_id: DEFAULT_VENUE_ID,
      member_id: memberResult.memberId,
      play_date: playDate,
      game_no: gameNo,
      nickname,
      buy_in_points: buyIn,
      rebuy_points: rebuy,
      money_in_points: moneyIn,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidateScores();
  return {
    success: true,
    memberCreated: memberResult.created,
    nickname,
    recordId: data.id,
  };
}

/** recordId로 행 전체 수정 (닉네임 변경 포함) */
export async function updateManualScoreRow(recordId: string, input: AddManualScoreInput) {
  if (!isSupabaseConfigured()) return { error: "데모 모드에서는 저장할 수 없습니다." };

  const playDate = input.playDate.trim();
  const gameNo = Math.max(1, Math.round(input.gameNo ?? 1));
  const buyIn = Math.max(0, Math.round(input.buyInPoints || 0));
  const rebuy = Math.max(0, Math.round(input.rebuyPoints || 0));
  const moneyIn = Math.max(0, Math.round(input.moneyInPoints || 0));

  if (!playDate) return { error: "날짜를 선택하세요." };
  if (buyIn + rebuy + moneyIn === 0) return { error: "점수를 1 이상 입력하세요." };

  const memberResult = await ensureMemberByNickname(input.nickname);
  if ("error" in memberResult && memberResult.error) return { error: memberResult.error };

  const supabase = await createClient();
  const nickname = memberResult.nickname;
  const now = new Date().toISOString();

  const { data: conflict } = await supabase
    .from("manual_score_daily")
    .select("id")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("play_date", playDate)
    .eq("game_no", gameNo)
    .eq("nickname", nickname)
    .neq("id", recordId)
    .maybeSingle();

  if (conflict) {
    return { error: `${nickname} 닉네임이 같은 게임에 이미 있습니다.` };
  }

  const { error } = await supabase
    .from("manual_score_daily")
    .update({
      play_date: playDate,
      game_no: gameNo,
      nickname,
      buy_in_points: buyIn,
      rebuy_points: rebuy,
      money_in_points: moneyIn,
      member_id: memberResult.memberId,
      updated_at: now,
    })
    .eq("id", recordId);

  if (error) return { error: error.message };

  revalidateScores();
  return {
    success: true,
    memberCreated: memberResult.created,
    nickname,
    recordId,
  };
}

export async function deleteManualScore(id: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { error } = await supabase.from("manual_score_daily").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateScores();
  return { success: true };
}
