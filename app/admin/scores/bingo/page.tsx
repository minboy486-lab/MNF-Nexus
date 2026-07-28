import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { BingoAdminClient } from "@/components/scores/BingoAdminClient";
import { getBingoMonthSheet } from "@/lib/data/bingo-queries";
import { currentMonthKey } from "@/lib/events/types";
import { getNicknameVisitCounts } from "@/lib/data/manual-scores-queries";
import { getMembers } from "@/lib/data/queries";
import { sortMembersByVisitCount } from "@/lib/scores/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export default async function BingoAdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const monthKey = params.month ?? currentMonthKey();

  const [sheet, members, visitCounts] = await Promise.all([
    getBingoMonthSheet(monthKey),
    getMembers(),
    getNicknameVisitCounts(),
  ]);

  const memberSuggestions = sortMembersByVisitCount(
    members.map((m) => ({
      id: m.id,
      nickname: m.nickname,
      display_name: m.display_name,
      visit_count: visitCounts[m.nickname] ?? 0,
    })),
  );

  return (
    <>
      <AdminTopBar title="빙고" subtitle="월별 16칸 미션 · 완료 등록" />
      <div className="admin-main flex-1 flex flex-col min-h-0 overflow-hidden p-2 md:p-3">
        {!isSupabaseConfigured() && (
          <p className="shrink-0 mb-3 text-sm text-tertiary bg-tertiary/10 border border-tertiary/30 rounded-lg px-3 py-2">
            Supabase 미연결 — 데모 모드에서는 저장되지 않습니다.
          </p>
        )}
        <BingoAdminClient sheet={sheet} members={memberSuggestions} />
      </div>
    </>
  );
}
