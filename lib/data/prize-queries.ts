import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenueId } from "@/lib/venue/active";
import type {
  GameFinishPlacement,
  GameIcmChop,
  GameWithRelations,
  Member,
  PrizeStructure,
  Seat,
} from "@/lib/types";

export async function getPrizeStructures() {
  if (!isSupabaseConfigured()) return [] as PrizeStructure[];

  const supabase = await createClient();
  const { data } = await supabase
    .from("prize_structures")
    .select("*")
    .or(`venue_id.eq.${await getActiveVenueId()},venue_id.is.null`)
    .order("name");

  return (data ?? []) as PrizeStructure[];
}

export async function getSettlementData(gameId: string) {
  if (!isSupabaseConfigured()) {
    return {
      game: null,
      placements: [] as GameFinishPlacement[],
      icm: null as GameIcmChop | null,
      survivors: [] as (Seat & { members: Member | null })[],
    };
  }

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select(
      `*, game_presets(*), prize_structures(placements)`,
    )
    .eq("id", gameId)
    .single();

  const { data: placements } = await supabase
    .from("game_finish_placements")
    .select("*, members(*)")
    .eq("game_id", gameId)
    .order("finish_rank", { ascending: true });

  const { data: icm } = await supabase
    .from("game_icm_chop")
    .select("*")
    .eq("game_id", gameId)
    .maybeSingle();

  const { data: seats } = await supabase
    .from("seats")
    .select("*, members(*)")
    .eq("game_id", gameId)
    .not("member_id", "is", null);

  return {
    game: game as GameWithRelations & {
      prize_structures?: { placements: unknown } | null;
      total_prize_pool: number;
      payout_places: number;
    },
    placements: (placements ?? []) as GameFinishPlacement[],
    icm: icm as GameIcmChop | null,
    survivors: (seats ?? []) as (Seat & { members: Member | null })[],
  };
}
