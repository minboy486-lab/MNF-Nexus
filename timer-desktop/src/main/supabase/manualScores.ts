import { getVenueOperatingDate } from "@mnf/venue/operating-date";
import { getSupabase } from "./client";
import { getConfiguredVenueId } from "./venue";

/** 웹 승점 표와 동일한 영업일 (KST 17:00 기준) */
export function kstPlayDate(now = new Date()): string {
  return getVenueOperatingDate(now);
}

export async function nextDailyGameNo(playDate?: string): Promise<number | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase에 연결할 수 없습니다." };
  const venueId = getConfiguredVenueId();
  const date = playDate ?? kstPlayDate();
  const { data, error } = await sb
    .from("manual_score_daily")
    .select("game_no")
    .eq("venue_id", venueId)
    .eq("play_date", date)
    .order("game_no", { ascending: false })
    .limit(1);
  if (error) return { error: error.message };
  const max = data?.[0]?.game_no;
  return typeof max === "number" ? max + 1 : 1;
}

export type GameScoreRow = {
  memberId: string;
  nickname: string;
  buyInPoints: number;
  rebuyPoints: number;
  moneyInPoints: number;
};

export async function upsertGameScores(
  gameNo: number,
  rows: GameScoreRow[],
  playDate?: string,
): Promise<{ ok: true; saved: number } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase에 연결할 수 없습니다." };
  if (!rows.length) return { error: "저장할 참가자가 없습니다." };

  const venueId = getConfiguredVenueId();
  const date = playDate ?? kstPlayDate();
  const now = new Date().toISOString();
  let saved = 0;

  for (const row of rows) {
    const nickname = row.nickname.trim();
    if (!nickname) continue;
    const buyIn = Math.max(0, Math.round(row.buyInPoints || 0));
    const rebuy = Math.max(0, Math.round(row.rebuyPoints || 0));
    const moneyIn = Math.max(0, Math.round(row.moneyInPoints || 0));
    if (buyIn + rebuy + moneyIn === 0) continue;

    const { data: existing } = await sb
      .from("manual_score_daily")
      .select("id")
      .eq("venue_id", venueId)
      .eq("play_date", date)
      .eq("game_no", gameNo)
      .eq("nickname", nickname)
      .maybeSingle();

    if (existing) {
      const { error } = await sb
        .from("manual_score_daily")
        .update({
          buy_in_points: buyIn,
          rebuy_points: rebuy,
          money_in_points: moneyIn,
          member_id: row.memberId,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await sb.from("manual_score_daily").insert({
        venue_id: venueId,
        member_id: row.memberId,
        play_date: date,
        game_no: gameNo,
        nickname,
        buy_in_points: buyIn,
        rebuy_points: rebuy,
        money_in_points: moneyIn,
      });
      if (error) return { error: error.message };
    }
    saved += 1;
  }

  if (saved === 0) return { error: "저장할 점수가 없습니다." };
  return { ok: true, saved };
}
