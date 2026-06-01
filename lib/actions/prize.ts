"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { icmChopAmounts, suggestPrizeAmounts } from "@/lib/poker/icm";
import type { PrizePlacement } from "@/lib/types";

async function getGamePrizeContext(gameId: string) {
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select(
      `*, prize_structures(placements), win_point_presets(placements)`,
    )
    .eq("id", gameId)
    .single();

  return { supabase, game };
}

function placementsFromGame(game: {
  prize_structures?: { placements: PrizePlacement[] } | null;
  payout_places: number;
  total_prize_pool: number;
}) {
  const raw = game.prize_structures?.placements ?? [];
  const placements = (Array.isArray(raw) ? raw : []) as PrizePlacement[];
  if (placements.length > 0) return placements;

  const n = game.payout_places;
  const defaultPercents = [40, 25, 15, 12, 8];
  return Array.from({ length: n }, (_, i) => ({
    rank: i + 1,
    percent: defaultPercents[i] ?? Math.round(100 / n),
  }));
}

export async function updateGamePrizeConfig(
  gameId: string,
  data: {
    totalPrizePool?: number;
    payoutPlaces?: number;
    prizeStructureId?: string | null;
  },
) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const patch: Record<string, unknown> = { settlement_status: "in_progress" };
  if (data.totalPrizePool != null) patch.total_prize_pool = data.totalPrizePool;
  if (data.payoutPlaces != null) patch.payout_places = data.payoutPlaces;
  if (data.prizeStructureId !== undefined) patch.prize_structure_id = data.prizeStructureId;

  const { error } = await supabase.from("games").update(patch).eq("id", gameId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/games/${gameId}/settlement`);
  return { success: true };
}

export async function recordElimination(
  gameId: string,
  memberId: string,
  chipsAtElim?: number,
) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const { supabase, game } = await getGamePrizeContext(gameId);
  if (!game) return { error: "게임 없음" };

  const { data: existing } = await supabase
    .from("game_finish_placements")
    .select("finish_rank")
    .eq("game_id", gameId);

  const eliminatedCount = existing?.length ?? 0;
  const rank = game.payout_places - eliminatedCount;
  if (rank < 1) {
    return { error: "지급 인원을 초과했습니다. payout_places를 늘리세요." };
  }

  const placements = placementsFromGame(game);
  const suggested = suggestPrizeAmounts(
    Number(game.total_prize_pool),
    game.payout_places,
    placements,
  );
  const suggestedAmount = suggested.get(rank) ?? 0;

  await supabase.from("seats").update({
    member_id: null,
    member_visit_id: null,
    seat_status: "empty",
  }).eq("game_id", gameId).eq("member_id", memberId);

  await supabase.from("members").update({ floor_status: "waiting" }).eq("id", memberId);

  const { error } = await supabase.from("game_finish_placements").insert({
    game_id: gameId,
    member_id: memberId,
    finish_rank: rank,
    chips_at_elim: chipsAtElim ?? null,
    suggested_amount: suggestedAmount,
    final_amount: suggestedAmount,
  });

  if (error) return { error: error.message };

  const survivor = Math.max(0, (game.survivor_count ?? 1) - 1);
  await supabase.from("games").update({
    survivor_count: survivor,
    settlement_status: "in_progress",
  }).eq("id", gameId);

  revalidatePath(`/admin/games/${gameId}/settlement`);
  revalidatePath(`/admin/games/${gameId}`);
  return { success: true, rank, suggestedAmount };
}

export async function updatePlacementAmount(
  placementId: string,
  finalAmount: number,
) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("game_finish_placements")
    .select("game_id")
    .eq("id", placementId)
    .single();

  const { error } = await supabase
    .from("game_finish_placements")
    .update({ final_amount: finalAmount })
    .eq("id", placementId);

  if (error) return { error: error.message };
  if (row) revalidatePath(`/admin/games/${row.game_id}/settlement`);
  return { success: true };
}

export async function recalculateSuggestions(gameId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const { supabase, game } = await getGamePrizeContext(gameId);
  if (!game) return { error: "게임 없음" };

  const placements = placementsFromGame(game);
  const suggested = suggestPrizeAmounts(
    Number(game.total_prize_pool),
    game.payout_places,
    placements,
  );

  const { data: rows } = await supabase
    .from("game_finish_placements")
    .select("id, finish_rank, final_amount")
    .eq("game_id", gameId);

  for (const row of rows ?? []) {
    const sug = suggested.get(row.finish_rank) ?? row.final_amount;
    await supabase
      .from("game_finish_placements")
      .update({ suggested_amount: sug })
      .eq("id", row.id);
  }

  revalidatePath(`/admin/games/${gameId}/settlement`);
  return { success: true };
}

export async function saveIcmChop(
  gameId: string,
  players: { memberId: string; nickname: string; chips: number }[],
) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const { supabase, game } = await getGamePrizeContext(gameId);
  if (!game) return { error: "게임 없음" };

  const { data: paid } = await supabase
    .from("game_finish_placements")
    .select("final_amount")
    .eq("game_id", gameId);

  const paidSum = (paid ?? []).reduce((s, r) => s + Number(r.final_amount), 0);
  const remaining = Math.max(0, Number(game.total_prize_pool) - paidSum);

  const sorted = [...players].sort((a, b) => b.chips - a.chips);
  const sortedAmounts = icmChopAmounts(
    sorted.map((p) => ({ memberId: p.memberId, chips: p.chips })),
    remaining,
  );
  const results = sorted.map((p, i) => ({
    member_id: p.memberId,
    nickname: p.nickname,
    chips: p.chips,
    icm_amount: sortedAmounts[i]?.amount ?? 0,
  }));

  await supabase.from("game_icm_chop").upsert({
    game_id: gameId,
    remaining_pool: remaining,
    inputs: players,
    results,
    finalized: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "game_id" });

  revalidatePath(`/admin/games/${gameId}/settlement`);
  return { success: true, remaining, results };
}

export async function applyIcmToTopThree(gameId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { data: chop } = await supabase
    .from("game_icm_chop")
    .select("results")
    .eq("game_id", gameId)
    .single();

  if (!chop?.results) return { error: "ICM 계산을 먼저 실행하세요." };

  const results = (chop.results as { member_id: string; icm_amount: number; chips?: number }[])
    .sort((a, b) => (b.chips ?? 0) - (a.chips ?? 0));

  for (let rank = 1; rank <= Math.min(3, results.length); rank++) {
    const r = results[rank - 1];
    if (!r) continue;

    const { data: existing } = await supabase
      .from("game_finish_placements")
      .select("id")
      .eq("game_id", gameId)
      .eq("member_id", r.member_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("game_finish_placements")
        .update({
          finish_rank: rank,
          final_amount: r.icm_amount,
          suggested_amount: r.icm_amount,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("game_finish_placements").insert({
        game_id: gameId,
        member_id: r.member_id,
        finish_rank: rank,
        suggested_amount: r.icm_amount,
        final_amount: r.icm_amount,
      });
    }
  }

  revalidatePath(`/admin/games/${gameId}/settlement`);
  return { success: true };
}

export async function finalizeGameSettlement(gameId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("*, win_point_presets(placements)")
    .eq("id", gameId)
    .single();

  if (!game) return { error: "게임 없음" };

  const { data: placements } = await supabase
    .from("game_finish_placements")
    .select("*, members(nickname)")
    .eq("game_id", gameId)
    .order("finish_rank", { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  for (const p of placements ?? []) {
    if (p.paid_at) continue;

    await supabase.from("money_transactions").insert({
      venue_id: game.venue_id,
      venue_session_id: game.venue_session_id,
      game_id: gameId,
      member_id: p.member_id,
      txn_type: "prize_payout",
      amount: -Number(p.final_amount),
      payment_method: "cash",
      created_by: user?.id ?? null,
    });

    await supabase
      .from("game_finish_placements")
      .update({ paid_at: new Date().toISOString() })
      .eq("id", p.id);

    const wpPlacements = (game.win_point_presets?.placements ?? []) as {
      rank: number;
      points: number;
    }[];
    const wp = wpPlacements.find((x) => x.rank === p.finish_rank);
    if (wp && game.venue_id) {
      const pts = Math.round(wp.points * Number(game.win_point_multiplier ?? 1));
      await supabase.from("win_point_ledger").insert({
        venue_id: game.venue_id,
        member_id: p.member_id,
        game_id: gameId,
        points: pts,
        multiplier: game.win_point_multiplier,
        finish_rank: p.finish_rank,
      });
    }
  }

  await supabase
    .from("games")
    .update({ status: "settled", settlement_status: "finalized" })
    .eq("id", gameId);

  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath(`/admin/games/${gameId}/settlement`);
  revalidatePath("/admin/dashboard");
  return { success: true };
}
