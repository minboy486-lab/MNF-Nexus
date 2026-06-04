"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { getOpenVenueSession } from "@/lib/venue/session";

export async function getStaffList() {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("is_active", true)
    .order("name");

  return data ?? [];
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
