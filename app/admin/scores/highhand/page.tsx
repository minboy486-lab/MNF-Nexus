import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { HighHandAdminClient } from "@/components/scores/HighHandAdminClient";
import { getHighHandsForDate } from "@/lib/data/high-hand-queries";
import { getNicknameVisitCounts } from "@/lib/data/manual-scores-queries";
import { getMembers } from "@/lib/data/queries";
import { sortMembersByVisitCount } from "@/lib/scores/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getVenueOperatingDate } from "@/lib/venue/operating-date";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function HighHandAdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const hasDateInUrl = Boolean(params.date);
  const playDate = params.date ?? getVenueOperatingDate();

  const [entries, members, visitCounts] = await Promise.all([
    getHighHandsForDate(playDate),
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
      <AdminTopBar title="하이핸드" subtitle="일별 포카드 · 스티플 · 로티플" />
      <div className="admin-main flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-6">
        {!isSupabaseConfigured() && (
          <p className="shrink-0 mb-3 text-sm text-tertiary bg-tertiary/10 border border-tertiary/30 rounded-lg px-3 py-2">
            Supabase 미연결 — 데모 모드에서는 저장되지 않습니다.
          </p>
        )}
        <HighHandAdminClient
          playDate={playDate}
          hasDateInUrl={hasDateInUrl}
          entries={entries}
          members={memberSuggestions}
        />
      </div>
    </>
  );
}
