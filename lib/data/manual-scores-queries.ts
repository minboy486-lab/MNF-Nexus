import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import type {
  AttendanceRow,
  ManualScoreDaily,
  ScoreRankingRow,
} from "@/lib/scores/types";
import { dailyTotalPoints } from "@/lib/scores/types";

function defaultFromTo(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, "0")}` };
}

export function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const y = prev.getFullYear();
  const m = prev.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${String(m).padStart(2, "0")}-01`,
    to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
  };
}

export function formatMonthLabel(from: string): string {
  const [y, m] = from.split("-");
  return `${y.slice(2)}년 ${Number(m)}월`;
}

export function currentMonthRange() {
  return defaultFromTo();
}

export async function getManualScoresForDate(playDate: string): Promise<ManualScoreDaily[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("manual_score_daily")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("play_date", playDate)
    .order("game_no", { ascending: true })
    .order("nickname", { ascending: true });

  return (data ?? []) as ManualScoreDaily[];
}

export async function getScoreRanking(from: string, to: string): Promise<ScoreRankingRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("manual_score_daily")
    .select("nickname, member_id, buy_in_points, rebuy_points, money_in_points, play_date")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .gte("play_date", from)
    .lte("play_date", to);

  const rows = data ?? [];
  const byNick = new Map<string, ScoreRankingRow & { dates: Set<string> }>();

  for (const row of rows) {
    const pts = dailyTotalPoints(row);
    const key = row.nickname;
    const prev = byNick.get(key);
    if (prev) {
      prev.total_points += pts;
      prev.dates.add(row.play_date);
      prev.visit_days = prev.dates.size;
    } else {
      byNick.set(key, {
        nickname: row.nickname,
        member_id: row.member_id,
        total_points: pts,
        visit_days: 1,
        dates: new Set([row.play_date]),
      });
    }
  }

  return [...byNick.values()]
    .map(({ dates: _, ...row }) => row).sort((a, b) => b.total_points - a.total_points);
}

/** 손님 공개 랭킹: 이번 달 점수 기록이 있는 회원만 */
export async function getPublicScoreRanking(from: string, to: string): Promise<ScoreRankingRow[]> {
  return getScoreRanking(from, to);
}

export async function getAttendanceSummary(from: string, to: string): Promise<AttendanceRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("manual_score_daily")
    .select("nickname, member_id, play_date")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .gte("play_date", from)
    .lte("play_date", to)
    .order("play_date", { ascending: false });

  const byNick = new Map<string, AttendanceRow>();

  for (const row of data ?? []) {
    const prev = byNick.get(row.nickname);
    if (prev) {
      prev.game_count += 1;
      if (!prev.visit_dates.includes(row.play_date)) {
        prev.visit_dates.push(row.play_date);
        prev.visit_count += 1;
      }
    } else {
      byNick.set(row.nickname, {
        nickname: row.nickname,
        member_id: row.member_id,
        visit_count: 1,
        game_count: 1,
        visit_dates: [row.play_date],
      });
    }
  }

  return [...byNick.values()]
    .map((r) => ({
      ...r,
      visit_dates: [...r.visit_dates].sort((a, b) => b.localeCompare(a)),
    }))
    .sort(
      (a, b) =>
        b.visit_count - a.visit_count ||
        b.game_count - a.game_count ||
        a.nickname.localeCompare(b.nickname, "ko"),
    );
}

/** 닉네임별 누적 방문일 수 (자동완성 정렬용) */
export async function getNicknameVisitCounts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("manual_score_daily")
    .select("nickname, play_date")
    .eq("venue_id", DEFAULT_VENUE_ID);

  const byNick = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const dates = byNick.get(row.nickname) ?? new Set<string>();
    dates.add(row.play_date);
    byNick.set(row.nickname, dates);
  }

  const result: Record<string, number> = {};
  for (const [nickname, dates] of byNick) {
    result[nickname] = dates.size;
  }
  return result;
}
