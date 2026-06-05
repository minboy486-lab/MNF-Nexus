"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { formatMp } from "@/lib/utils/mp";
import { requireOpenSession } from "@/lib/venue/session";

export type PaymentMethod = "cash" | "card" | "transfer" | "points" | "credit";

export async function recordMoneyTransaction(params: {
  gameId?: string | null;
  memberId: string;
  seatId?: string | null;
  memberVisitId?: string | null;
  txnType: string;
  amount: number;
  paymentMethod?: PaymentMethod | null;
  note?: string;
}) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const sessionResult = await requireOpenSession();
  if ("error" in sessionResult) return { error: sessionResult.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("money_transactions").insert({
    venue_id: DEFAULT_VENUE_ID,
    venue_session_id: sessionResult.session.id,
    game_id: params.gameId ?? null,
    member_id: params.memberId,
    seat_id: params.seatId ?? null,
    member_visit_id: params.memberVisitId ?? null,
    txn_type: params.txnType,
    amount: params.amount,
    payment_method: params.paymentMethod ?? null,
    note: params.note ?? null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  if (params.paymentMethod === "credit" && params.amount > 0) {
    const { data: member } = await supabase
      .from("members")
      .select("credit_balance")
      .eq("id", params.memberId)
      .single();
    await supabase
      .from("members")
      .update({ credit_balance: (member?.credit_balance ?? 0) - params.amount })
      .eq("id", params.memberId);
  }

  if (params.paymentMethod === "points" && params.amount > 0) {
    const { data: member } = await supabase
      .from("members")
      .select("point_balance")
      .eq("id", params.memberId)
      .single();
    await supabase
      .from("members")
      .update({ point_balance: (member?.point_balance ?? 0) - params.amount })
      .eq("id", params.memberId);
  }

  revalidatePath("/admin/guests");
  revalidatePath("/counter");
  return { success: true };
}

async function bumpMemberBuyInCount(
  gameId: string,
  memberId: string,
  seatId: string,
  paymentMethod: PaymentMethod,
  options?: { setFirstPayment?: boolean },
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("game_member_buy_ins")
    .select("buy_in_count")
    .eq("game_id", gameId)
    .eq("member_id", memberId)
    .maybeSingle();

  const next = (existing?.buy_in_count ?? 0) + 1;

  await supabase.from("game_member_buy_ins").upsert(
    { game_id: gameId, member_id: memberId, buy_in_count: next },
    { onConflict: "game_id,member_id" },
  );

  const seatUpdate: {
    buy_in_count: number;
    last_payment_method: PaymentMethod;
    first_payment_method?: PaymentMethod;
  } = { buy_in_count: next, last_payment_method: paymentMethod };

  if (options?.setFirstPayment) {
    seatUpdate.first_payment_method = paymentMethod;
  }

  await supabase.from("seats").update(seatUpdate).eq("id", seatId);

  return next;
}

export async function recordBuyIn(
  gameId: string,
  seatId: string,
  memberId: string,
  amount: number,
  paymentMethod: PaymentMethod = "cash",
  memberVisitId?: string | null,
) {
  const result = await recordMoneyTransaction({
    gameId,
    memberId,
    seatId,
    memberVisitId,
    txnType: "buy_in",
    amount,
    paymentMethod,
  });
  if (result.error) return result;

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("entry_count, survivor_count")
    .eq("id", gameId)
    .single();

  await supabase
    .from("games")
    .update({
      entry_count: (game?.entry_count ?? 0) + 1,
      survivor_count: (game?.survivor_count ?? 0) + 1,
    })
    .eq("id", gameId);

  await bumpMemberBuyInCount(gameId, memberId, seatId, paymentMethod, {
    setFirstPayment: true,
  });

  await supabase
    .from("seats")
    .update({ chips: amount })
    .eq("id", seatId);

  revalidatePath("/admin/tables");
  revalidatePath("/staff/tables");
  return { success: true };
}

export async function recordRebuy(
  gameId: string,
  seatId: string,
  memberId: string,
  amount: number,
  paymentMethod: PaymentMethod = "cash",
) {
  const result = await recordMoneyTransaction({
    gameId,
    memberId,
    seatId,
    txnType: "rebuy",
    amount,
    paymentMethod,
  });
  if (result.error) return result;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: seat } = await supabase
    .from("seats")
    .select("rebuy_count, chips")
    .eq("id", seatId)
    .single();

  await bumpMemberBuyInCount(gameId, memberId, seatId, paymentMethod);

  await supabase
    .from("seats")
    .update({
      rebuy_count: (seat?.rebuy_count ?? 0) + 1,
      chips: Number(seat?.chips ?? 0) + amount,
      last_rebuy_at: now,
    })
    .eq("id", seatId);

  const { data: game } = await supabase
    .from("games")
    .select("rebuy_count")
    .eq("id", gameId)
    .single();

  await supabase
    .from("games")
    .update({ rebuy_count: (game?.rebuy_count ?? 0) + 1 })
    .eq("id", gameId);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let actor = "staff";
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("login_id, display_name")
      .eq("id", user.id)
      .maybeSingle();
    actor = profile?.login_id ?? profile?.display_name ?? actor;
  }

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: `리바인 ${formatMp(amount)} (${paymentMethod}) — 처리: ${actor}`,
    level: "info",
  });

  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath("/admin/tables");
  revalidatePath("/staff/tables");
  return { success: true, rebuyAt: now };
}
