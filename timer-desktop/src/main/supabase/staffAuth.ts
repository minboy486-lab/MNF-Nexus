import { getSupabase, DEFAULT_VENUE_ID, loginEmails, createPasswordClient } from "./client";

export type StaffAuthOk = {
  userId: string;
  staffId: string;
  name: string;
  loginId: string;
  checkedIn: boolean;
  checkedInAt: string | null;
};

export async function loginStaff(loginId: string, password: string): Promise<StaffAuthOk | { error: string }> {
  const sb = getSupabase();
  const auth = createPasswordClient();
  if (!sb || !auth) return { error: "서버에 Supabase가 설정되지 않았습니다." };
  const emails = loginEmails(loginId);
  if (!emails.length || password.length < 1) return { error: "아이디와 비밀번호를 입력하세요." };

  let userId: string | null = null;
  let lastErr = "로그인에 실패했습니다.";
  for (const email of emails) {
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (data.user && !error) {
      userId = data.user.id;
      break;
    }
    if (error) lastErr = error.message === "Invalid login credentials" ? "아이디 또는 비밀번호가 올바르지 않습니다." : error.message;
  }
  try {
    await auth.auth.signOut();
  } catch {
    /* ignore */
  }
  if (!userId) return { error: lastErr };

  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, display_name, login_id")
    .eq("id", userId)
    .maybeSingle();

  const role = profile?.role ?? "";
  if (role && !["staff", "admin", "manager"].includes(role)) {
    return { error: "직원 계정이 아닙니다." };
  }

  let staff = (
    await sb.from("staff").select("id, name, is_active").eq("profile_id", userId).eq("is_active", true).maybeSingle()
  ).data;

  if (!staff) {
    const name = profile?.display_name || loginId;
    const { data: created, error } = await sb
      .from("staff")
      .insert({
        venue_id: DEFAULT_VENUE_ID,
        profile_id: userId,
        name,
        role: "staff",
        hourly_wage: 0,
        is_active: true,
      })
      .select("id, name, is_active")
      .single();
    if (error || !created) return { error: error?.message ?? "직원 프로필을 만들 수 없습니다." };
    staff = created;
  }

  const open = await getOpenShift(staff.id);
  return {
    userId,
    staffId: staff.id,
    name: staff.name,
    loginId: profile?.login_id ?? loginId,
    checkedIn: !!open,
    checkedInAt: open?.checked_in_at ?? null,
  };
}

export async function claimStaffByLoginId(loginId: string): Promise<StaffAuthOk | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "서버에 Supabase가 설정되지 않았습니다." };
  const id = loginId.trim().toLowerCase();
  if (!id) return { error: "아이디가 없습니다." };

  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, display_name, login_id")
    .eq("login_id", id)
    .maybeSingle();
  if (!profile) return { error: "직원 계정을 찾을 수 없습니다." };
  const role = profile.role ?? "";
  if (role && !["staff", "admin", "manager"].includes(role)) {
    return { error: "직원 계정이 아닙니다." };
  }

  let staff = (
    await sb.from("staff").select("id, name, is_active").eq("profile_id", profile.id).eq("is_active", true).maybeSingle()
  ).data;
  if (!staff) {
    const name = profile.display_name || id;
    const { data: created, error } = await sb
      .from("staff")
      .insert({
        venue_id: DEFAULT_VENUE_ID,
        profile_id: profile.id,
        name,
        role: "staff",
        hourly_wage: 0,
        is_active: true,
      })
      .select("id, name, is_active")
      .single();
    if (error || !created) return { error: error?.message ?? "직원 프로필을 만들 수 없습니다." };
    staff = created;
  }

  const punched = await clockInStaff(staff.id);
  if ("error" in punched) return { error: punched.error };
  return {
    userId: profile.id,
    staffId: staff.id,
    name: staff.name,
    loginId: profile.login_id ?? id,
    checkedIn: true,
    checkedInAt: punched.checkedInAt,
  };
}

async function getOpenShift(staffId: string) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("staff_shifts")
    .select("id, checked_in_at")
    .eq("staff_id", staffId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function openVenueSessionId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("venue_sessions")
    .select("id")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function clockInStaff(
  staffId: string,
): Promise<{ action: "in"; checkedInAt: string; already: boolean } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "서버에 Supabase가 설정되지 않았습니다." };
  const open = await getOpenShift(staffId);
  if (open) {
    return { action: "in", checkedInAt: open.checked_in_at, already: true };
  }
  const venueSessionId = await openVenueSessionId();
  const { data, error } = await sb
    .from("staff_shifts")
    .insert({
      staff_id: staffId,
      venue_session_id: venueSessionId,
    })
    .select("checked_in_at")
    .single();
  if (error) return { error: error.message };
  return { action: "in", checkedInAt: data.checked_in_at, already: false };
}

export async function clockOutStaff(
  staffId: string,
): Promise<{ action: "out" } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "서버에 Supabase가 설정되지 않았습니다." };
  const open = await getOpenShift(staffId);
  if (!open) return { action: "out" };
  const now = new Date().toISOString();
  const { error } = await sb.from("staff_shifts").update({ checked_out_at: now }).eq("id", open.id);
  if (error) return { error: error.message };
  return { action: "out" };
}
