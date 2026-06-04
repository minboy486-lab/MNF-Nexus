"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { getOpenVenueSession } from "@/lib/venue/session";

export type SessionLedgerTotals = {
  totalBuyIn: number;
  totalRebuy: number;
  totalPrize: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalPointNet: number;
  totalCreditNew: number;
  totalCreditCollected: number;
  balanceDelta: number;
};

export async function computeSessionLedgerTotals(
  sessionId: string,
): Promise<SessionLedgerTotals> {
  if (!isSupabaseConfigured()) {
    return {
      totalBuyIn: 0,
      totalRebuy: 0,
      totalPrize: 0,
      totalCash: 0,
      totalCard: 0,
      totalTransfer: 0,
      totalPointNet: 0,
      totalCreditNew: 0,
      totalCreditCollected: 0,
      balanceDelta: 0,
    };
  }

  const supabase = await createClient();
  const { data: txns } = await supabase
    .from("money_transactions")
    .select("txn_type, amount, payment_method")
    .eq("venue_session_id", sessionId);

  let totalBuyIn = 0;
  let totalRebuy = 0;
  let totalPrize = 0;
  let totalCash = 0;
  let totalCard = 0;
  let totalTransfer = 0;
  let totalPointNet = 0;
  let totalCreditNew = 0;
  let totalCreditCollected = 0;

  for (const t of txns ?? []) {
    const amt = Number(t.amount);
    switch (t.txn_type) {
      case "buy_in":
        totalBuyIn += amt;
        break;
      case "rebuy":
        totalRebuy += amt;
        break;
      case "prize_payout":
        totalPrize += Math.abs(amt);
        break;
      case "cash_in":
        totalCash += amt;
        break;
      case "card_in":
        totalCard += amt;
        break;
      case "transfer_in":
        totalTransfer += amt;
        break;
      case "point_spend":
        totalPointNet -= amt;
        break;
      case "point_earn":
        totalPointNet += amt;
        break;
      case "credit_charge":
        totalCreditNew += amt;
        break;
      case "credit_collect":
        totalCreditCollected += amt;
        break;
      default:
        break;
    }
  }

  const buyInTotal = totalBuyIn + totalRebuy;
  const inflows =
    totalPrize +
    totalCash +
    totalCard +
    totalTransfer +
    totalPointNet +
    totalCreditCollected -
    totalCreditNew;

  const balanceDelta = buyInTotal - inflows;

  return {
    totalBuyIn,
    totalRebuy,
    totalPrize,
    totalCash,
    totalCard,
    totalTransfer,
    totalPointNet,
    totalCreditNew,
    totalCreditCollected,
    balanceDelta,
  };
}

export async function getSessionGameLines(sessionId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data: games } = await supabase
    .from("games")
    .select("id, daily_game_number, status")
    .eq("venue_session_id", sessionId)
    .order("daily_game_number", { ascending: true });

  const lines = [];
  for (const g of games ?? []) {
    const { data: txns } = await supabase
      .from("money_transactions")
      .select("txn_type, amount")
      .eq("game_id", g.id);

    let buyIn = 0;
    let prize = 0;
    for (const t of txns ?? []) {
      const amt = Number(t.amount);
      if (t.txn_type === "buy_in" || t.txn_type === "rebuy") buyIn += amt;
      if (t.txn_type === "prize_payout") prize += Math.abs(amt);
    }
    lines.push({
      gameId: g.id,
      label: `게임 #${g.daily_game_number ?? "?"}`,
      status: g.status,
      buyIn,
      prize,
      balance: buyIn - prize,
    });
  }
  return lines;
}

export async function getCreditOutstanding() {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, nickname, phone, credit_balance")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .lt("credit_balance", 0)
    .order("credit_balance", { ascending: true });

  return data ?? [];
}

export async function finalizeDailyCloseout(notes?: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const session = await getOpenVenueSession();
  if (!session) return { error: "열린 영업 세션이 없습니다." };

  const totals = await computeSessionLedgerTotals(session.id);
  const gameLines = await getSessionGameLines(session.id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const buyInTotal = totals.totalBuyIn + totals.totalRebuy;

  const { data: closeout, error } = await supabase
    .from("daily_closeouts")
    .upsert(
      {
        venue_id: DEFAULT_VENUE_ID,
        venue_session_id: session.id,
        total_buy_in: buyInTotal,
        total_prize: totals.totalPrize,
        total_cash: totals.totalCash,
        total_card: totals.totalCard,
        total_transfer: totals.totalTransfer,
        total_point_net: totals.totalPointNet,
        total_credit_new: totals.totalCreditNew,
        total_credit_collected: totals.totalCreditCollected,
        balance_delta: totals.balanceDelta,
        notes: notes ?? null,
        closed_by: user?.id ?? null,
        closed_at: new Date().toISOString(),
      },
      { onConflict: "venue_session_id" },
    )
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("daily_closeout_lines")
    .delete()
    .eq("daily_closeout_id", closeout.id);

  let sort = 0;
  for (const line of gameLines) {
    await supabase.from("daily_closeout_lines").insert({
      daily_closeout_id: closeout.id,
      line_kind: "game",
      game_id: line.gameId,
      label: line.label,
      buy_in_total: line.buyIn,
      prize_total: line.prize,
      balance: line.balance,
      sort_order: sort++,
    });
  }

  revalidatePath("/admin/settlement/daily");
  revalidatePath("/admin/dashboard");
  return { success: true, closeoutId: closeout.id, totals };
}
