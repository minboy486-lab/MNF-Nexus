"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { requireOpenSession } from "@/lib/venue/session";

function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "");
}

export async function lookupMemberByPhone(phone: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const digits = normalizePhone(phone);
  if (digits.length < 10) return { error: "전화번호를 10자리 이상 입력하세요." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("phone", digits)
    .maybeSingle();

  return { member: data };
}

export async function registerMember(phone: string, nickname: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const digits = normalizePhone(phone);
  if (digits.length < 10) return { error: "전화번호를 10자리 이상 입력하세요." };
  if (!nickname.trim()) return { error: "닉네임을 입력하세요." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("members")
    .select("id")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("phone", digits)
    .maybeSingle();

  if (existing) return { error: "이미 등록된 번호입니다. 조회를 사용하세요." };

  const { data, error } = await supabase
    .from("members")
    .insert({
      venue_id: DEFAULT_VENUE_ID,
      phone: digits,
      nickname: nickname.trim(),
      floor_status: "visitor",
    })
    .select("*")
    .single();

  if (error) return { error: error.message };

  const visit = await checkInVisit(data.id);
  if (visit.error) return visit;

  revalidatePath("/counter");
  revalidatePath("/admin/guests");
  return { member: data, visitId: visit.visitId };
}

/** 조회/가입 후 방문 중 목록에 올림 (같은 날 재방문 = 새 visit 행). */
export async function checkInVisit(memberId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const sessionResult = await requireOpenSession();
  if ("error" in sessionResult) return { error: sessionResult.error };

  const supabase = await createClient();

  await supabase
    .from("member_visits")
    .update({
      status: "left",
      checked_out_at: new Date().toISOString(),
    })
    .eq("member_id", memberId)
    .eq("venue_session_id", sessionResult.session.id)
    .is("checked_out_at", null);

  const { data, error } = await supabase
    .from("member_visits")
    .insert({
      venue_id: DEFAULT_VENUE_ID,
      venue_session_id: sessionResult.session.id,
      member_id: memberId,
      status: "on_floor",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("members")
    .update({ floor_status: "visitor" })
    .eq("id", memberId);

  revalidatePath("/counter");
  revalidatePath("/admin/guests");
  return { visitId: data.id };
}

export async function checkOutVisit(visitId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { data: visit } = await supabase
    .from("member_visits")
    .select("member_id")
    .eq("id", visitId)
    .single();

  if (!visit) return { error: "방문 기록을 찾을 수 없습니다." };

  const { data: seated } = await supabase
    .from("seats")
    .select("id")
    .eq("member_id", visit.member_id)
    .limit(1);

  if (seated?.length) {
    return { error: "좌석에 앉아 있습니다. 먼저 싯아웃 처리하세요." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("member_visits")
    .update({ status: "left", checked_out_at: now })
    .eq("id", visitId);

  if (error) return { error: error.message };

  await supabase
    .from("members")
    .update({ floor_status: "visitor" })
    .eq("id", visit.member_id);

  revalidatePath("/counter");
  revalidatePath("/admin/guests");
  return { success: true };
}

export async function lookupAndCheckIn(phone: string) {
  const result = await lookupMemberByPhone(phone);
  if (result.error) return result;
  if (!result.member) return { error: "등록된 회원이 없습니다. 신규 가입을 진행하세요." };

  const visit = await checkInVisit(result.member.id);
  if (visit.error) return visit;

  return { member: result.member, visitId: visit.visitId };
}
