import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { DailySettlementClient } from "@/components/settlement/DailySettlementClient";
import {
  computeSessionLedgerTotals,
  getSessionGameLines,
  getCreditOutstanding,
} from "@/lib/actions/settlement";
import { getOpenVenueSession } from "@/lib/data/queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function DailySettlementPage() {
  const session = await getOpenVenueSession();
  const configured = isSupabaseConfigured();

  const totals = session
    ? await computeSessionLedgerTotals(session.id)
    : null;
  const gameLines = session ? await getSessionGameLines(session.id) : [];
  const creditMembers = configured ? await getCreditOutstanding() : [];

  return (
    <>
      <AdminTopBar title="일일 정산" subtitle="대차 검증 · 게임별 · 외상 현황" />
      <div className="admin-main flex-1 overflow-y-auto p-6 md:p-8">
        <DailySettlementClient
          session={session}
          totals={totals}
          gameLines={gameLines}
          creditMembers={creditMembers}
          configured={configured}
        />
      </div>
    </>
  );
}
