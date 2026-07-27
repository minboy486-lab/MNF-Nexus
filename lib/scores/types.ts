import type { Member } from "@/lib/types";

export type ManualScoreDaily = {
  id: string;
  venue_id: string;
  member_id: string | null;
  play_date: string;
  nickname: string;
  buy_in_points: number;
  rebuy_points: number;
  money_in_points: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export function dailyTotalPoints(row: Pick<
  ManualScoreDaily,
  "buy_in_points" | "rebuy_points" | "money_in_points"
>): number {
  return row.buy_in_points + row.rebuy_points + row.money_in_points;
}

export type ScoreRankingRow = {
  nickname: string;
  member_id: string | null;
  total_points: number;
  visit_days: number;
};

export type AttendanceRow = {
  nickname: string;
  member_id: string | null;
  visit_count: number;
  visit_dates: string[];
};

export type MemberSuggestion = Pick<Member, "id" | "nickname" | "display_name">;
