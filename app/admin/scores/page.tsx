import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { ScoresAttendanceClient } from "@/components/scores/ScoresAttendanceClient";
import {
  currentMonthRange,
  getAttendanceSummary,
  getManualScoresForDate,
  getScoreRanking,
} from "@/lib/data/manual-scores-queries";
import { getMembers } from "@/lib/data/queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
};

export default async function ScoresPage({ searchParams }: Props) {
  const params = await searchParams;
  const month = currentMonthRange();
  const today = new Date().toISOString().slice(0, 10);
  const playDate = params.date ?? today;
  const from = params.from ?? month.from;
  const to = params.to ?? month.to;

  const [members, todayScores, ranking, attendance] = await Promise.all([
    getMembers(),
    getManualScoresForDate(playDate),
    getScoreRanking(from, to),
    getAttendanceSummary(from, to),
  ]);

  const memberSuggestions = members.map((m) => ({
    id: m.id,
    nickname: m.nickname,
    display_name: m.display_name,
  }));

  return (
    <>
      <AdminTopBar
        title="승점및출석"
        subtitle="게임 점수 기록 · 순위 · 방문 DB (임시)"
      />
      <div className="admin-main flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-6">
        {!isSupabaseConfigured() && (
          <p className="shrink-0 mb-3 text-sm text-tertiary bg-tertiary/10 border border-tertiary/30 rounded-lg px-3 py-2">
            Supabase 미연결 — 데모 모드에서는 저장되지 않습니다.
          </p>
        )}
        <ScoresAttendanceClient
          members={memberSuggestions}
          todayScores={todayScores}
          ranking={ranking}
          attendance={attendance}
          defaultDate={playDate}
          periodFrom={from}
          periodTo={to}
        />
      </div>
    </>
  );
}
