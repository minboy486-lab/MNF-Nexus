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
  const byNick = new Map<string, ScoreRankingRow>();

  for (const row of rows) {
    const pts = dailyTotalPoints(row);
    const key = row.nickname;
    const prev = byNick.get(key);
    if (prev) {
      prev.total_points += pts;
      prev.visit_days += 1;
    } else {
      byNick.set(key, {
        nickname: row.nickname,
        member_id: row.member_id,
        total_points: pts,
        visit_days: 1,
      });
    }
  }

  return [...byNick.values()].sort((a, b) => b.total_points - a.total_points);
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
      if (!prev.visit_dates.includes(row.play_date)) {
        prev.visit_dates.push(row.play_date);
        prev.visit_count += 1;
      }
    } else {
      byNick.set(row.nickname, {
        nickname: row.nickname,
        member_id: row.member_id,
        visit_count: 1,
        visit_dates: [row.play_date],
      });
    }
  }

  return [...byNick.values()]
    .map((r) => ({
      ...r,
      visit_dates: [...r.visit_dates].sort((a, b) => b.localeCompare(a)),
    }))
    .sort((a, b) => b.visit_count - a.visit_count || a.nickname.localeCompare(b.nickname));
}
