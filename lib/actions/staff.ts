"use server";

import { revalidatePath } from "next/cache";
import { isManagerOrAdmin } from "@/lib/auth/roles";
import { getProfileRole } from "@/lib/auth/profile";
import {
  isValidStaffLoginId,
  loginIdToAuthEmail,
  normalizeStaffLoginId,
} from "@/lib/auth/staff-login";
import { ensureVenueStaffRow } from "@/lib/staff/ensure-row";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { getKSTNowParts, toISODate } from "@/lib/venue/operating-date";
import { getOpenVenueSession } from "@/lib/venue/session";

export type StaffListRow = {
  id: string;
  name: string;
  role: string;
  hourly_wage: number;
  profile_id: string | null;
  login_id: string | null;
  todayIn: string | null;
  todayOut: string | null;
  working: boolean;
};

function kstDayRange(now = new Date()): { start: string; end: string } {
  const { year, month, day } = getKSTNowParts(now);
  const start = new Date(`${toISODate(year, month, day)}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getStaffList(): Promise<StaffListRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("is_active", true)
    .order("name");

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const profileIds = rows.map((s) => s.profile_id).filter((id): id is string => !!id);
  const loginByProfile = new Map<string, string>();
  if (profileIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, login_id")
      .in("id", profileIds);
    for (const p of profiles ?? []) {
      if (p.login_id) loginByProfile.set(p.id, p.login_id);
    }
  }

  const ids = rows.map((s) => s.id);
  const { start, end } = kstDayRange();
  const lookback = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const [{ data: recentShifts }, { data: openShifts }] = await Promise.all([
    supabase
      .from("staff_shifts")
      .select("staff_id, checked_in_at, checked_out_at")
      .in("staff_id", ids)
      .gte("checked_in_at", lookback),
    supabase
      .from("staff_shifts")
      .select("staff_id, checked_in_at, checked_out_at")
      .in("staff_id", ids)
      .is("checked_out_at", null),
  ]);
  const shifts = [...(openShifts ?? []), ...(recentShifts ?? [])];

  const today = new Map<string, { in: string | null; out: string | null; working: boolean }>();
  for (const sh of shifts ?? []) {
    const cur = today.get(sh.staff_id) ?? { in: null, out: null, working: false };
    const inAt = sh.checked_in_at as string;
    const inToday = inAt >= start && inAt < end;
    if (inToday && (!cur.in || inAt < cur.in)) cur.in = inAt;
    if (!sh.checked_out_at) {
      cur.working = true;
      if (!cur.in || inAt < cur.in) cur.in = inAt;
      cur.out = null;
    } else if (inToday && !cur.working) {
      if (!cur.out || sh.checked_out_at > cur.out) cur.out = sh.checked_out_at;
    }
    today.set(sh.staff_id, cur);
  }

  return rows.map((s) => {
    const t = today.get(s.id);
    return {
      id: s.id,
      name: s.name,
      role: s.role,
      hourly_wage: s.hourly_wage,
      profile_id: s.profile_id ?? null,
      login_id: s.profile_id ? (loginByProfile.get(s.profile_id) ?? null) : null,
      todayIn: t?.in ?? null,
      todayOut: t?.working ? null : (t?.out ?? null),
      working: t?.working ?? false,
    };
  });
}

export async function createStaffAccount(payload: {
  login_id: string;
  password: string;
  name: string;
  hourly_wage: number;
}): Promise<{ success: true } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const role = await getProfileRole(user.id);
  if (!isManagerOrAdmin(role)) return { error: "관리자만 직원 계정을 만들 수 있습니다." };
  if (!isSupabaseAdminConfigured()) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다. 계정 생성에 서비스 롤 키가 필요합니다.",
    };
  }

  const loginId = normalizeStaffLoginId(payload.login_id);
  const password = payload.password;
  const name = payload.name.trim();
  const hourlyWage = Number.isFinite(payload.hourly_wage) ? Math.max(0, Math.round(payload.hourly_wage)) : 0;

  if (!loginId || !password || password.length < 6) {
    return { error: "아이디와 비밀번호(6자 이상)를 입력하세요." };
  }
  if (!isValidStaffLoginId(loginId)) {
    return { error: "아이디는 영문 소문자·숫자·_(3~32자)만 사용할 수 있습니다." };
  }
  if (!name) return { error: "직원 이름을 입력하세요." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("login_id", loginId)
    .maybeSingle();
  if (existing) return { error: "이미 사용 중인 아이디입니다." };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginIdToAuthEmail(loginId),
    password,
    email_confirm: true,
    user_metadata: { display_name: name, login_id: loginId },
  });
  if (createError) return { error: createError.message };
  if (!created.user) return { error: "계정 생성에 실패했습니다." };

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: "staff",
      display_name: name,
      login_id: loginId,
    })
    .eq("id", created.user.id);
  if (profileError) return { error: profileError.message };

  const staffErr = await ensureVenueStaffRow(admin, {
    profileId: created.user.id,
    name,
    role: "staff",
    hourlyWage,
  });
  if (staffErr.error) return { error: staffErr.error };

  revalidatePath("/admin/staff");
  revalidatePath("/admin/accounts");
  return { success: true };
}

export async function staffCheckIn(staffId: string, pin?: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const session = await getOpenVenueSession();
  if (!session) return { error: "영업 세션이 열려 있지 않습니다." };

  const supabase = await createClient();

  if (pin) {
    const { data: staff } = await supabase
      .from("staff")
      .select("pin_hash")
      .eq("id", staffId)
      .single();
    if (staff?.pin_hash && staff.pin_hash !== pin) {
      return { error: "PIN이 일치하지 않습니다." };
    }
  }

  const { data: open } = await supabase
    .from("staff_shifts")
    .select("id")
    .eq("staff_id", staffId)
    .is("checked_out_at", null)
    .limit(1);

  if (open?.length) return { error: "이미 출근 중입니다." };

  const { error } = await supabase.from("staff_shifts").insert({
    staff_id: staffId,
    venue_session_id: session.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/staff");
  return { success: true };
}

export async function staffCheckOut(staffId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: shift } = await supabase
    .from("staff_shifts")
    .select("id")
    .eq("staff_id", staffId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) return { error: "출근 기록이 없습니다." };

  const { error } = await supabase
    .from("staff_shifts")
    .update({ checked_out_at: now })
    .eq("id", shift.id);

  if (error) return { error: error.message };
  revalidatePath("/admin/staff");
  return { success: true };
}

export async function recordStaffAdvance(
  staffId: string,
  amount: number,
  memo?: string,
) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("staff_advances").insert({
    staff_id: staffId,
    venue_id: DEFAULT_VENUE_ID,
    amount,
    memo: memo ?? null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/staff");
  return { success: true };
}

export async function getStaffPayrollSummary(yearMonth: string) {
  if (!isSupabaseConfigured()) return { staff: [], period: null };

  const supabase = await createClient();
  const [y, m] = yearMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1).toISOString();
  const end = new Date(y, m, 1).toISOString();

  const staff = await getStaffList();
  const lines = [];

  for (const s of staff) {
    const { data: shifts } = await supabase
      .from("staff_shifts")
      .select("checked_in_at, checked_out_at")
      .eq("staff_id", s.id)
      .gte("checked_in_at", start)
      .lt("checked_in_at", end);

    let hours = 0;
    for (const sh of shifts ?? []) {
      const out = sh.checked_out_at
        ? new Date(sh.checked_out_at).getTime()
        : Date.now();
      hours += (out - new Date(sh.checked_in_at).getTime()) / 3600000;
    }

    const { data: advances } = await supabase
      .from("staff_advances")
      .select("amount")
      .eq("staff_id", s.id)
      .gte("paid_at", start)
      .lt("paid_at", end);

    const advanceTotal = (advances ?? []).reduce((sum, a) => sum + a.amount, 0);
    const gross = Math.round(hours * (s.hourly_wage ?? 0));
    const net = gross - advanceTotal;

    lines.push({
      staffId: s.id,
      name: s.name,
      hourlyWage: s.hourly_wage,
      hours: Math.round(hours * 100) / 100,
      gross,
      advances: advanceTotal,
      net,
    });
  }

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("year_month", yearMonth)
    .maybeSingle();

  return { staff: lines, period };
}

export async function closePayrollPeriod(yearMonth: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const summary = await getStaffPayrollSummary(yearMonth);
  const supabase = await createClient();

  const totalGross = summary.staff.reduce((s, l) => s + l.gross, 0);
  const totalAdvances = summary.staff.reduce((s, l) => s + l.advances, 0);
  const totalNet = summary.staff.reduce((s, l) => s + l.net, 0);

  const { data: period, error } = await supabase
    .from("payroll_periods")
    .upsert(
      {
        venue_id: DEFAULT_VENUE_ID,
        year_month: yearMonth,
        status: "closed",
        total_gross: totalGross,
        total_advances: totalAdvances,
        total_net: totalNet,
        closed_at: new Date().toISOString(),
      },
      { onConflict: "venue_id,year_month" },
    )
    .select("id")
    .single();

  if (error) return { error: error.message };

  for (const line of summary.staff) {
    await supabase.from("payroll_lines").upsert(
      {
        payroll_period_id: period.id,
        staff_id: line.staffId,
        hours_worked: line.hours,
        gross_pay: line.gross,
        advances_deducted: line.advances,
        net_pay: line.net,
      },
      { onConflict: "payroll_period_id,staff_id" },
    );
  }

  revalidatePath("/admin/staff");
  revalidatePath("/admin/settlement/monthly");
  return { success: true };
}

export type MyShiftRow = {
  id: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  hours: number;
};

export type MyStaffHome = {
  staffId: string;
  name: string;
  loginId: string;
  working: boolean;
  checkedInAt: string | null;
  monthLabel: string;
  monthHours: number;
  shifts: MyShiftRow[];
};

type MyStaffCtx =
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
      staffId: string;
      name: string;
      loginId: string;
    };

async function requireMyStaffRow(): Promise<MyStaffCtx> {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, login_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: staffRows } = await supabase
    .from("staff")
    .select("id, name, is_active")
    .eq("profile_id", user.id)
    .order("is_active", { ascending: false })
    .limit(1);
  let staff = staffRows?.[0] ?? null;

  if (staff && !staff.is_active) {
    return { error: "비활성화된 직원 계정입니다." };
  }

  if (!staff) {
    if (!isSupabaseAdminConfigured()) {
      return { error: "직원 프로필이 없습니다. 관리자에게 계정 연결을 요청하세요." };
    }
    const name = profile?.display_name || profile?.login_id || "직원";
    const ensured = await ensureVenueStaffRow(createAdminClient(), {
      profileId: user.id,
      name,
      role: "staff",
    });
    if (ensured.error) return { error: ensured.error };
    const { data: created } = await supabase
      .from("staff")
      .select("id, name, is_active")
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!created) return { error: "직원 정보를 만들 수 없습니다." };
    staff = created;
  }

  if (!staff.id) return { error: "직원 정보를 만들 수 없습니다." };

  return {
    supabase,
    userId: user.id,
    staffId: staff.id,
    name: staff.name || profile?.display_name || "직원",
    loginId: profile?.login_id ?? "",
  };
}

export async function getMyStaffHome(): Promise<MyStaffHome | { error: string }> {
  const me = await requireMyStaffRow();
  if ("error" in me) return { error: me.error };

  const { year, month } = getKSTNowParts();
  const monthStart = new Date(`${toISODate(year, month, 1)}T00:00:00+09:00`);
  const nextMonth = month === 12 ? new Date(`${year + 1}-01-01T00:00:00+09:00`) : new Date(`${toISODate(year, month + 1, 1)}T00:00:00+09:00`);

  const { data: shifts } = await me.supabase
    .from("staff_shifts")
    .select("id, checked_in_at, checked_out_at")
    .eq("staff_id", me.staffId)
    .gte("checked_in_at", monthStart.toISOString())
    .lt("checked_in_at", nextMonth.toISOString())
    .order("checked_in_at", { ascending: false });

  const now = Date.now();
  let monthHours = 0;
  let working = false;
  let checkedInAt: string | null = null;
  const rows: MyShiftRow[] = [];

  for (const sh of shifts ?? []) {
    const inAt = new Date(sh.checked_in_at).getTime();
    const outAt = sh.checked_out_at ? new Date(sh.checked_out_at).getTime() : now;
    const hours = Math.max(0, (outAt - inAt) / 3600000);
    monthHours += hours;
    if (!sh.checked_out_at) {
      working = true;
      checkedInAt = sh.checked_in_at;
    }
    rows.push({
      id: sh.id,
      checkedInAt: sh.checked_in_at,
      checkedOutAt: sh.checked_out_at,
      hours: Math.round(hours * 100) / 100,
    });
  }

  return {
    staffId: me.staffId,
    name: me.name,
    loginId: me.loginId,
    working,
    checkedInAt,
    monthLabel: `${year}.${String(month).padStart(2, "0")}`,
    monthHours: Math.round(monthHours * 100) / 100,
    shifts: rows,
  };
}

export async function punchMeIn(): Promise<{ success: true; already: boolean } | { error: string }> {
  const me = await requireMyStaffRow();
  if ("error" in me) return { error: me.error };

  const { data: open } = await me.supabase
    .from("staff_shifts")
    .select("id")
    .eq("staff_id", me.staffId)
    .is("checked_out_at", null)
    .limit(1);

  if (open?.length) return { success: true, already: true };

  const session = await getOpenVenueSession();
  const { error } = await me.supabase.from("staff_shifts").insert({
    staff_id: me.staffId,
    venue_session_id: session?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/staff", "layout");
  revalidatePath("/staff");
  revalidatePath("/staff/attendance");
  revalidatePath("/admin/staff");
  return { success: true, already: false };
}

export async function punchMeOut(): Promise<{ success: true } | { error: string }> {
  const me = await requireMyStaffRow();
  if ("error" in me) return { error: me.error };

  const { data: shift } = await me.supabase
    .from("staff_shifts")
    .select("id")
    .eq("staff_id", me.staffId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) return { error: "출근 기록이 없습니다." };

  const { error } = await me.supabase
    .from("staff_shifts")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", shift.id);
  if (error) return { error: error.message };
  revalidatePath("/staff", "layout");
  revalidatePath("/staff");
  revalidatePath("/staff/attendance");
  revalidatePath("/admin/staff");
  return { success: true };
}
