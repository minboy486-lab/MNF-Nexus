import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { PaymentMethod } from "@/lib/actions/ledger";
import type { Seat } from "@/lib/types";

export type BuyInLogEntry = {
  id: string;
  /** 게임 내 N번째 바인 (1 = 최초 바인) */
  sequence: number;
  is_initial: boolean;
  amount: number;
  payment_method: PaymentMethod | null;
  occurred_at: string;
  actor_login_id: string | null;
  actor_name: string | null;
};

/** @deprecated Use BuyInLogEntry */
export type RebuyLogEntry = BuyInLogEntry;

export async function enrichSeatsWithPaymentMethods(
  seats: Seat[],
  gameId: string,
): Promise<Seat[]> {
  if (!isSupabaseConfigured()) return seats;

  const missing = seats.filter((s) => s.member_id && !s.first_payment_method);
  if (missing.length === 0) return seats;

  const supabase = await createClient();
  const memberIds = [...new Set(missing.map((s) => s.member_id!))];

  const { data: txns } = await supabase
    .from("money_transactions")
    .select("member_id, payment_method, occurred_at")
    .eq("game_id", gameId)
    .eq("txn_type", "buy_in")
    .in("member_id", memberIds)
    .not("payment_method", "is", null)
    .order("occurred_at", { ascending: true });

  const firstByMember = new Map<string, PaymentMethod>();
  for (const txn of txns ?? []) {
    if (!txn.member_id || !txn.payment_method || firstByMember.has(txn.member_id)) continue;
    firstByMember.set(txn.member_id, txn.payment_method as PaymentMethod);
  }

  const enriched = seats.map((seat) => {
    if (!seat.member_id || seat.first_payment_method) return seat;
    const method = firstByMember.get(seat.member_id);
    if (!method) return seat;

    return {
      ...seat,
      first_payment_method: method,
      last_payment_method: seat.last_payment_method ?? method,
    };
  });

  const toPersist = enriched.filter(
    (seat, i) =>
      seat.first_payment_method &&
      seat.first_payment_method !== seats[i].first_payment_method,
  );

  await Promise.all(
    toPersist.map((seat) =>
      supabase
        .from("seats")
        .update({
          first_payment_method: seat.first_payment_method,
          last_payment_method: seat.last_payment_method,
        })
        .eq("id", seat.id),
    ),
  );

  return enriched;
}

export async function getMemberBuyInLogs(
  gameId: string,
  memberId: string,
  limit = 20,
): Promise<BuyInLogEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("money_transactions")
    .select(
      "id, amount, payment_method, occurred_at, txn_type, profiles:created_by(login_id, display_name)",
    )
    .eq("game_id", gameId)
    .eq("member_id", memberId)
    .in("txn_type", ["buy_in", "rebuy"])
    .order("occurred_at", { ascending: true });

  const entries = (data ?? []).map((row, index) => {
    const profile = row.profiles as { login_id?: string | null; display_name?: string | null } | null;
    const sequence = index + 1;
    return {
      id: row.id,
      sequence,
      is_initial: sequence === 1,
      amount: row.amount,
      payment_method: row.payment_method as PaymentMethod | null,
      occurred_at: row.occurred_at,
      actor_login_id: profile?.login_id ?? null,
      actor_name: profile?.display_name ?? null,
    };
  });

  return [...entries].reverse().slice(0, limit);
}

/** @deprecated Use getMemberBuyInLogs */
export async function getMemberRebuyLogs(
  gameId: string,
  memberId: string,
  limit = 20,
): Promise<BuyInLogEntry[]> {
  return getMemberBuyInLogs(gameId, memberId, limit);
}
