import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  demoApprovals,
  demoAssignments,
  demoClocks,
  demoGames,
  demoLogs,
  demoPlayers,
  demoPresets,
  demoSeats,
  demoTables,
} from "@/lib/demo/data";
import type {
  GameWithRelations,
  Member,
  MemberVisitWithMember,
  PhysicalTable,
  Seat,
  VenueSession,
} from "@/lib/types";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";

export async function getPhysicalTables() {
  if (!isSupabaseConfigured()) return demoTables;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("physical_tables")
    .select("*")
    .order("code");

  if (error || !data?.length) return demoTables;
  return data as PhysicalTable[];
}

export async function getPhysicalTable(id: string) {
  const tables = await getPhysicalTables();
  return tables.find((t) => t.id === id) ?? null;
}

export async function getGamePresets() {
  if (!isSupabaseConfigured()) return demoPresets;

  const supabase = await createClient();
  const { data } = await supabase.from("game_presets").select("*").order("name");
  return data?.length ? data : demoPresets;
}

export async function getGames() {
  if (!isSupabaseConfigured()) return demoGames;

  const supabase = await createClient();
  const { data } = await supabase.from("games").select("*").order("created_at", { ascending: false });
  return data?.length ? data : demoGames;
}

export async function getGame(gameId: string): Promise<GameWithRelations | null> {
  if (!isSupabaseConfigured()) {
    const game = demoGames.find((g) => g.id === gameId);
    if (!game) return null;
    return {
      ...game,
      game_clocks: demoClocks[gameId] ?? null,
      game_presets: demoPresets.find((p) => p.id === game.preset_id) ?? null,
      game_table_assignments: demoAssignments
        .filter((a) => a.game_id === gameId)
        .map((a) => ({
          ...a,
          physical_tables: demoTables.find((t) => t.id === a.physical_table_id)!,
        })),
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select(
      `*, game_clocks(*), game_presets(*), game_table_assignments(*, physical_tables(*))`,
    )
    .eq("id", gameId)
    .single();

  if (!data) return null;
  const clocks = data.game_clocks;
  return {
    ...data,
    game_clocks: Array.isArray(clocks) ? clocks[0] : clocks,
  } as GameWithRelations;
}

export async function getSeatsForGame(gameId: string, physicalTableId?: string) {
  if (!isSupabaseConfigured()) {
    return demoSeats.filter(
      (s) =>
        s.game_id === gameId &&
        (!physicalTableId || s.physical_table_id === physicalTableId),
    );
  }

  const supabase = await createClient();
  let q = supabase
    .from("seats")
    .select("*, members(*)")
    .eq("game_id", gameId);
  if (physicalTableId) q = q.eq("physical_table_id", physicalTableId);
  const { data } = await q;
  return (data ?? []) as Seat[];
}

export async function getMembers() {
  if (!isSupabaseConfigured()) return demoPlayers;

  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .order("created_at", { ascending: false });
  return data?.length ? (data as Member[]) : demoPlayers;
}

/** @deprecated */
export const getVenuePlayers = getMembers;

export async function getActiveMemberVisits() {
  if (!isSupabaseConfigured()) return [] as MemberVisitWithMember[];

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("venue_sessions")
    .select("id")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return [];

  const { data } = await supabase
    .from("member_visits")
    .select("*, members(*)")
    .eq("venue_session_id", session.id)
    .eq("status", "on_floor")
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: true });

  return (data ?? []) as MemberVisitWithMember[];
}

export async function getOpenVenueSession(): Promise<VenueSession | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_sessions")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as VenueSession | null;
}

export async function getPendingApprovals() {
  if (!isSupabaseConfigured()) return demoApprovals;

  const supabase = await createClient();
  const { data } = await supabase
    .from("approval_requests")
    .select("*, members(*)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getRecentLogs(limit = 10) {
  if (!isSupabaseConfigured()) return demoLogs.slice(0, limit);

  const supabase = await createClient();
  const { data } = await supabase
    .from("game_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getDashboardStats() {
  const tables = await getPhysicalTables();
  const games = await getGames();
  const players = await getMembers();
  const activeVisits = await getActiveMemberVisits();
  const activeGames = games.filter((g) => g.status === "running" || g.status === "registration_closed");

  return {
    activeTables: tables.filter((t) => t.current_game_id).length,
    activeGames: activeGames.length,
    visitors: activeVisits.length,
    onFloor: activeVisits.length,
    waiting: players.filter((p) => p.floor_status === "waiting").length,
    inGame: players.filter((p) => p.floor_status === "in_game").length,
    reserved: players.filter((p) => p.floor_status === "reserved").length,
  };
}
