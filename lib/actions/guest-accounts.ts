"use server";

import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/auth/roles";
import { getProfileRole } from "@/lib/auth/profile";
import { hashPassword } from "@/lib/auth/password";
import {
  isValidStaffLoginId,
  loginIdToAuthEmail,
  normalizeStaffLoginId,
} from "@/lib/auth/staff-login";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { getActiveVenueId } from "@/lib/venue/active";
import { GUEST_DEFAULT_PASSWORD, type GuestAccountRow } from "@/lib/guest/accounts";
import type { Member } from "@/lib/types";

type AdminGate = { error: string } | { userId: string };

async function requireGuestAccountAdmin(): Promise<AdminGate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const role = await getProfileRole(user.id);
  if (!isAdminRole(role)) {
    return { error: "관리자만 손님 계정을 관리할 수 있습니다." };
  }
  if (!isSupabaseAdminConfigured()) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY가 필요합니다." };
  }
  return { userId: user.id };
}

export async function isLoginIdTakenGlobally(loginId: string): Promise<boolean> {
  const id = normalizeStaffLoginId(loginId);
  if (!id || !isSupabaseAdminConfigured()) return false;

  const admin = createAdminClient();
  const { data: profileHit } = await admin
    .from("profiles")
    .select("id")
    .eq("login_id", id)
    .maybeSingle();
  if (profileHit) return true;

  const { data: memberHit } = await admin
    .from("members")
    .select("id")
    .eq("login_id", id)
    .maybeSingle();
  return !!memberHit;
}

export async function checkGuestLoginIdAvailable(
  loginId: string,
): Promise<{ available: boolean; error?: string }> {
  const gate = await requireGuestAccountAdmin();
  if ("error" in gate) return { available: false, error: gate.error };

  const id = normalizeStaffLoginId(loginId);
  if (!id) return { available: false, error: "아이디를 입력하세요." };
  if (!isValidStaffLoginId(id)) {
    return { available: false, error: "영문 소문자·숫자·_(3~32자)만 사용할 수 있습니다." };
  }

  const taken = await isLoginIdTakenGlobally(id);
  return { available: !taken };
}

export async function checkGuestNicknameAvailable(
  nickname: string,
  excludeMemberId?: string,
): Promise<{ available: boolean; error?: string }> {
  const gate = await requireGuestAccountAdmin();
  if ("error" in gate) return { available: false, error: gate.error };

  const nick = nickname.trim();
  if (!nick) return { available: false, error: "닉네임을 입력하세요." };

  const venueId = await getActiveVenueId();
  const admin = createAdminClient();

  let query = admin
    .from("members")
    .select("id")
    .eq("venue_id", venueId)
    .eq("nickname", nick);

  if (excludeMemberId) {
    query = query.neq("id", excludeMemberId);
  }

  const { data } = await query.maybeSingle();
  return { available: !data };
}

export async function listGuestAccounts(): Promise<
  { accounts: GuestAccountRow[] } | { error: string }
> {
  const gate = await requireGuestAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const venueId = await getActiveVenueId();
  const admin = createAdminClient();

  const { data: members, error } = await admin
    .from("members")
    .select(
      "id, user_id, login_id, nickname, display_name, phone, point_balance, credit_balance",
    )
    .eq("venue_id", venueId)
    .not("login_id", "is", null)
    .order("nickname", { ascending: true });

  if (error) return { error: error.message };

  const userIds = (members ?? [])
    .map((m) => m.user_id)
    .filter((id): id is string => typeof id === "string");

  const lastSignIn = new Map<string, string | null>();
  if (userIds.length) {
    const { data: listData } = await admin.auth.admin.listUsers({ perPage: 500 });
    for (const u of listData.users) {
      if (userIds.includes(u.id)) {
        lastSignIn.set(u.id, u.last_sign_in_at ?? null);
      }
    }
  }

  const accounts: GuestAccountRow[] = (members ?? []).map((m) => ({
    member_id: m.id,
    user_id: m.user_id,
    login_id: m.login_id as string,
    nickname: m.nickname,
    display_name: m.display_name,
    phone: m.phone,
    point_balance: Number(m.point_balance ?? 0),
    credit_balance: Number(m.credit_balance ?? 0),
    last_sign_in_at: m.user_id ? (lastSignIn.get(m.user_id) ?? null) : null,
  }));

  return { accounts };
}

export async function createGuestAccount(payload: {
  login_id: string;
  nickname: string;
  display_name?: string;
  phone?: string;
}): Promise<{ success: true; member: Member } | { error: string }> {
  const gate = await requireGuestAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const loginId = normalizeStaffLoginId(payload.login_id);
  const nickname = payload.nickname.trim();
  const displayName = payload.display_name?.trim() || null;
  const phone = payload.phone?.replace(/\D/g, "") || null;

  if (!loginId || !isValidStaffLoginId(loginId)) {
    return { error: "아이디는 영문 소문자·숫자·_(3~32자)만 사용할 수 있습니다." };
  }
  if (!nickname) return { error: "닉네임을 입력하세요." };
  if (phone && phone.length < 10) return { error: "전화번호는 10자리 이상이거나 비워 두세요." };

  if (await isLoginIdTakenGlobally(loginId)) {
    return { error: "이미 사용 중인 아이디입니다." };
  }

  const venueId = await getActiveVenueId();
  const admin = createAdminClient();
  const passwordHash = await hashPassword(GUEST_DEFAULT_PASSWORD);

  const { data: nickDup } = await admin
    .from("members")
    .select("id")
    .eq("venue_id", venueId)
    .eq("nickname", nickname)
    .maybeSingle();
  if (nickDup) return { error: "이미 사용 중인 닉네임입니다." };

  const authEmail = loginIdToAuthEmail(loginId);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: GUEST_DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName ?? nickname, login_id: loginId },
  });
  if (createError) return { error: createError.message };
  if (!created.user) return { error: "계정 생성에 실패했습니다." };

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: "guest",
      display_name: displayName ?? nickname,
      login_id: loginId,
    })
    .eq("id", created.user.id);
  if (profileError) return { error: profileError.message };

  const { data: member, error: memberError } = await admin
    .from("members")
    .insert({
      venue_id: venueId,
      login_id: loginId,
      password_hash: passwordHash,
      nickname,
      display_name: displayName,
      phone,
      user_id: created.user.id,
      floor_status: "registered",
    })
    .select("*")
    .single();

  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    if (memberError.code === "23505") {
      return { error: "이미 사용 중인 닉네임 또는 아이디입니다." };
    }
    return { error: memberError.message };
  }

  revalidateGuestPaths();
  return { success: true, member: member as Member };
}

export async function updateGuestAccount(payload: {
  member_id: string;
  nickname: string;
  display_name?: string;
  phone?: string;
}): Promise<{ success: true } | { error: string }> {
  const gate = await requireGuestAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const nickname = payload.nickname.trim();
  if (!nickname) return { error: "닉네임을 입력하세요." };
  const phone = payload.phone?.replace(/\D/g, "") || null;
  if (phone && phone.length < 10) return { error: "전화번호는 10자리 이상이거나 비워 두세요." };

  const venueId = await getActiveVenueId();
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("id, user_id, venue_id, nickname")
    .eq("id", payload.member_id)
    .maybeSingle();
  if (!member || member.venue_id !== venueId) {
    return { error: "손님을 찾을 수 없습니다." };
  }

  const { data: nickDup } = await admin
    .from("members")
    .select("id")
    .eq("venue_id", venueId)
    .eq("nickname", nickname)
    .neq("id", member.id)
    .maybeSingle();
  if (nickDup) return { error: "이미 사용 중인 닉네임입니다." };

  const displayName = payload.display_name?.trim() || null;

  const { error } = await admin
    .from("members")
    .update({
      nickname,
      display_name: displayName,
      phone,
    })
    .eq("id", member.id);
  if (error) return { error: error.message };

  if (member.user_id) {
    await admin
      .from("profiles")
      .update({ display_name: displayName ?? nickname })
      .eq("id", member.user_id);
    await admin.auth.admin.updateUserById(member.user_id, {
      user_metadata: { display_name: displayName ?? nickname },
    });
  }

  revalidateGuestPaths();
  return { success: true };
}

export async function resetGuestAccountPassword(
  memberId: string,
): Promise<{ success: true } | { error: string }> {
  const gate = await requireGuestAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const venueId = await getActiveVenueId();
  const admin = createAdminClient();
  const passwordHash = await hashPassword(GUEST_DEFAULT_PASSWORD);

  const { data: member } = await admin
    .from("members")
    .select("id, user_id, venue_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.venue_id !== venueId) {
    return { error: "손님을 찾을 수 없습니다." };
  }
  if (!member.user_id) {
    return { error: "로그인 계정이 연결되지 않은 손님입니다." };
  }

  const { error: pwError } = await admin.auth.admin.updateUserById(member.user_id, {
    password: GUEST_DEFAULT_PASSWORD,
  });
  if (pwError) return { error: pwError.message };

  await admin.from("members").update({ password_hash: passwordHash }).eq("id", member.id);

  revalidateGuestPaths();
  return { success: true };
}

export async function deleteGuestAccount(
  memberId: string,
): Promise<{ success: true } | { error: string }> {
  const gate = await requireGuestAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const venueId = await getActiveVenueId();
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("id, user_id, venue_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.venue_id !== venueId) {
    return { error: "손님을 찾을 수 없습니다." };
  }

  const { error } = await admin.from("members").delete().eq("id", member.id);
  if (error) return { error: error.message };

  if (member.user_id && member.user_id !== gate.userId) {
    await admin.auth.admin.deleteUser(member.user_id);
  }

  revalidateGuestPaths();
  return { success: true };
}

/** 기존 계정 관리의 손님(role=guest) 프로필을 현재 지점 members에 연동 */
export async function linkOrphanGuestProfile(profileId: string): Promise<
  { success: true } | { error: string }
> {
  const gate = await requireGuestAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const venueId = await getActiveVenueId();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, login_id, display_name, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile || profile.role !== "guest" || !profile.login_id) {
    return { error: "연동할 손님 계정을 찾을 수 없습니다." };
  }

  const { data: existing } = await admin
    .from("members")
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (existing) return { error: "이미 이 지점에 등록되어 있습니다." };

  const loginId = profile.login_id;
  const nickname = profile.display_name?.trim() || loginId;
  const passwordHash = await hashPassword(GUEST_DEFAULT_PASSWORD);

  const { error } = await admin.from("members").insert({
    venue_id: venueId,
    login_id: loginId,
    password_hash: passwordHash,
    nickname,
    display_name: profile.display_name,
    user_id: profile.id,
    floor_status: "registered",
  });
  if (error) {
    if (error.code === "23505") return { error: "닉네임 또는 아이디가 이미 사용 중입니다." };
    return { error: error.message };
  }

  revalidateGuestPaths();
  return { success: true };
}

export async function listOrphanGuestProfiles(): Promise<
  { profiles: { id: string; login_id: string; display_name: string | null }[] } | { error: string }
> {
  const gate = await requireGuestAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const venueId = await getActiveVenueId();
  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, login_id, display_name")
    .eq("role", "guest")
    .not("login_id", "is", null)
    .order("login_id");

  if (error) return { error: error.message };

  const { data: linked } = await admin
    .from("members")
    .select("user_id")
    .eq("venue_id", venueId)
    .not("user_id", "is", null);

  const linkedIds = new Set((linked ?? []).map((r) => r.user_id));
  const orphans = (profiles ?? []).filter((p) => !linkedIds.has(p.id));

  return { profiles: orphans };
}

function revalidateGuestPaths() {
  revalidatePath("/admin/guests");
  revalidatePath("/admin/guests/visits");
  revalidatePath("/admin/guests/points");
  revalidatePath("/admin/guests/accounts");
  revalidatePath("/guest");
}
