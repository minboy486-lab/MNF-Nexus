import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { MonthlySettlementClient } from "@/components/settlement/MonthlySettlementClient";
import { computeSessionLedgerTotals } from "@/lib/actions/settlement";
import { getStaffPayrollSummary } from "@/lib/actions/staff";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function MonthlySettlementPage() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let revenue = 0;
  let expenses = 0;
  let winPoints: { nickname: string; points: number }[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [y, m] = yearMonth.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m, 1).toISOString();

    const { data: sessions } = await supabase
      .from("venue_sessions")
      .select("id")
      .eq("venue_id", DEFAULT_VENUE_ID)
      .gte("opened_at", start)
      .lt("opened_at", end);

    for (const s of sessions ?? []) {
      const t = await computeSessionLedgerTotals(s.id);
      revenue += t.totalBuyIn + t.totalRebuy;
    }

    const { data: exp } = await supabase
      .from("expenses")
      .select("amount")
      .eq("venue_id", DEFAULT_VENUE_ID)
      .gte("spent_at", start)
      .lt("spent_at", end);

    expenses = (exp ?? []).reduce((sum, e) => sum + e.amount, 0);

    const { data: ledger } = await supabase
      .from("win_point_ledger")
      .select("points, members(nickname)")
      .eq("venue_id", DEFAULT_VENUE_ID)
      .gte("created_at", start)
      .lt("created_at", end);

    const map = new Map<string, number>();
    for (const row of ledger ?? []) {
      const nick = (row.members as { nickname?: string } | null)?.nickname ?? "?";
      map.set(nick, (map.get(nick) ?? 0) + row.points);
    }
    winPoints = [...map.entries()]
      .map(([nickname, points]) => ({ nickname, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  }

  const payroll = isSupabaseConfigured()
    ? await getStaffPayrollSummary(yearMonth)
    : { staff: [], period: null };

  return (
    <>
      <AdminTopBar title="월간 정산" subtitle="매출 · 지출 · 급여 · 승점" />
      <div className="admin-main flex-1 overflow-y-auto p-6 md:p-8">
        <MonthlySettlementClient
          yearMonth={yearMonth}
          revenue={revenue}
          expenses={expenses}
          payroll={payroll.staff}
          payrollNet={payroll.staff.reduce((s, l) => s + l.net, 0)}
          winPoints={winPoints}
          configured={isSupabaseConfigured()}
        />
      </div>
    </>
  );
}
