"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { requireOpenSession } from "@/lib/venue/session";

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function normalizeLoginId(raw: string) {
  return raw.trim().toLowerCase();
}

export async function checkNicknameAvailable(nickname: string) {
  const nick = nickname.trim();
  if (!nick) return { available: false, error: "닉네임을 입력하세요." };
  if (!isSupabaseConfigured()) return { available: true };

  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("nickname", nick)
    .maybeSingle();

  return { available: !data };
}

export async function checkLoginIdAvailable(loginId: string) {
  const id = normalizeLoginId(loginId);
  if (!id) return { available: false, error: "아이디를 입력하세요." };
  if (id.length < 3) return { available: false, error: "아이디는 3자 이상입니다." };
  if (!isSupabaseConfigured()) return { available: true };

  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("login_id", id)
    .maybeSingle();

  return { available: !data };
}

export type CreateMemberInput = {
  loginId: string;
  password: string;
  nickname: string;
  displayName?: string;
  phone?: string;
};

export async function createMember(input: CreateMemberInput) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const loginId = normalizeLoginId(input.loginId);
  const nickname = input.nickname.trim();
  const password = input.password;

  if (!loginId) return { error: "아이디를 입력하세요." };
  if (loginId.length < 3) return { error: "아이디는 3자 이상입니다." };
  if (!password || password.length < 4) return { error: "비밀번호는 4자 이상입니다." };
  if (!nickname) return { error: "닉네임을 입력하세요." };

  const nickCheck = await checkNicknameAvailable(nickname);
  if (nickCheck.error) return { error: nickCheck.error };
  if (!nickCheck.available) return { error: "이미 사용 중인 닉네임입니다." };

  const idCheck = await checkLoginIdAvailable(loginId);
  if (idCheck.error) return { error: idCheck.error };
  if (!idCheck.available) return { error: "이미 사용 중인 아이디입니다." };

  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (phone && phone.length < 10) return { error: "전화번호는 10자리 이상이거나 비워 두세요." };

  const supabase = await createClient();
  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from("members")
    .insert({
      venue_id: DEFAULT_VENUE_ID,
      login_id: loginId,
      password_hash: passwordHash,
      nickname,
      display_name: input.displayName?.trim() || null,
      phone,
      floor_status: "registered",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("nickname")) return { error: "이미 사용 중인 닉네임입니다." };
      return { error: "이미 사용 중인 아이디입니다." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/guests");
  revalidatePath("/counter");
  return { member: data };
}

/** @deprecated use createMember */
export async function registerMember(phone: string, nickname: string) {
  return createMember({
    loginId: `guest_${Date.now()}`,
    password: "0000",
    nickname,
    phone,
  });
}

export async function lookupMemberByPhone(phone: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const digits = normalizePhone(phone);
  if (!digits || digits.length < 10) return { error: "전화번호를 10자리 이상 입력하세요." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("phone", digits)
    .maybeSingle();

  return { member: data };
}

export async function lookupMemberByNicknameOrLogin(query: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const q = query.trim();
  if (!q) return { error: "닉네임 또는 아이디를 입력하세요." };

  const supabase = await createClient();
  const { data: byNick } = await supabase
    .from("members")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("nickname", q)
    .maybeSingle();

  if (byNick) return { member: byNick };

  const { data: byLogin } = await supabase
    .from("members")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("login_id", normalizeLoginId(q))
    .maybeSingle();

  return { member: byLogin ?? null };
}

/** 방문 중으로 설정 (영업 세션 필요) */
export async function checkInVisit(memberId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const sessionResult = await requireOpenSession();
  if ("error" in sessionResult) return { error: sessionResult.error };

  const supabase = await createClient();

  const { data: already } = await supabase
    .from("member_visits")
    .select("id")
    .eq("member_id", memberId)
    .eq("venue_session_id", sessionResult.session.id)
    .eq("status", "on_floor")
    .is("checked_out_at", null)
    .maybeSingle();

  if (already) return { error: "이미 방문 중입니다.", visitId: already.id };

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
  revalidatePath("/admin/tables");
  return { visitId: data.id };
}

/** 여러 손님을 한 번에 방문 중으로 */
export async function checkInVisits(memberIds: string[]) {
  if (!memberIds.length) return { error: "선택된 손님이 없습니다." };

  const succeeded: string[] = [];
  const failed: { memberId: string; error: string }[] = [];

  for (const memberId of memberIds) {
    const res = await checkInVisit(memberId);
    if (res && "error" in res && res.error) {
      failed.push({ memberId, error: res.error });
    } else {
      succeeded.push(memberId);
    }
  }

  if (!succeeded.length) {
    return { error: failed[0]?.error ?? "방문 등록에 실패했습니다.", failed };
  }

  return { succeeded, failed };
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
    .update({ floor_status: "registered" })
    .eq("id", visit.member_id);

  revalidatePath("/counter");
  revalidatePath("/admin/guests");
  return { success: true };
}
