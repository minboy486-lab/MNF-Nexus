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
  GameClock,
  GameWithRelations,
  Member,
  MemberVisitWithMember,
  PhysicalTable,
  Seat,
  VenueSession,
} from "@/lib/types";
import { getActiveVenueId } from "@/lib/venue/active";
import { YEOKSAM_VENUE_ID } from "@/lib/venue/constants";

export async function getPhysicalTables() {
  if (!isSupabaseConfigured()) return demoTables;

  const venueId = await getActiveVenueId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("physical_tables")
    .select("*")
    .eq("venue_id", venueId)
    .order("code");

  if (error) return demoTables;
  return (data ?? []) as PhysicalTable[];
}

export async function getPhysicalTable(id: string) {
  const tables = await getPhysicalTables();
  return tables.find((t) => t.id === id) ?? null;
}

export async function getGamePresets() {
  if (!isSupabaseConfigured()) return demoPresets;

  const venueId = await getActiveVenueId();
  const supabase = await createClient();
  let query = supabase.from("game_presets").select("*").order("name");
  query =
    venueId === YEOKSAM_VENUE_ID
      ? query.or(`venue_id.eq.${venueId},venue_id.is.null`)
      : query.eq("venue_id", venueId);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function getGames() {
  if (!isSupabaseConfigured()) return demoGames;

  const venueId = await getActiveVenueId();
  const supabase = await createClient();
  let query = supabase.from("games").select("*").order("created_at", { ascending: false });
  query =
    venueId === YEOKSAM_VENUE_ID
      ? query.or(`venue_id.eq.${venueId},venue_id.is.null`)
      : query.eq("venue_id", venueId);
  const { data } = await query;
  return data ?? [];
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

export async function getGameClock(gameId: string): Promise<GameClock | null> {
  if (!isSupabaseConfigured()) return demoClocks[gameId] ?? null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("game_clocks")
    .select("*")
    .eq("game_id", gameId)
    .maybeSingle();
  return (data as GameClock | null) ?? null;
}

/** 진행 중 게임에 실제 착석한 member_id (종료된 게임 잔여 좌석 제외) */
export async function getSeatedMemberIdsInActiveGames(): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return demoSeats
      .filter((s) => {
        const game = demoGames.find((g) => g.id === s.game_id);
        return s.member_id && game && (game.status === "running" || game.status === "registration_closed");
      })
      .map((s) => s.member_id as string);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("seats")
    .select("member_id, games!inner(status)")
    .not("member_id", "is", null)
    .in("games.status", ["running", "registration_closed"]);

  return [
    ...new Set(
      (data ?? [])
        .map((row) => row.member_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
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
  const seats = (data ?? []) as Seat[];
  const { enrichSeatsWithPaymentMethods } = await import("@/lib/data/seat-enrichment");
  return enrichSeatsWithPaymentMethods(seats, gameId);
}

export async function getMembers(search?: string) {
  if (!isSupabaseConfigured()) {
    const q = search?.trim().toLowerCase();
    if (!q) return demoPlayers;
    return demoPlayers.filter(
      (m) =>
        m.nickname.toLowerCase().includes(q) ||
        m.login_id?.toLowerCase().includes(q) ||
        m.display_name?.toLowerCase().includes(q),
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from("members")
    .select("*")
    .eq("venue_id", await getActiveVenueId())
    .order("nickname", { ascending: true });

  const { data } = await query;
  let list = (data ?? []) as Member[];

  const q = search?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (m) =>
        m.nickname.toLowerCase().includes(q) ||
        (m.login_id?.toLowerCase().includes(q) ?? false) ||
        (m.display_name?.toLowerCase().includes(q) ?? false) ||
        (m.phone?.includes(q) ?? false),
    );
  }

  return list.length ? list : [];
}

/** 손님별 누적 방문(체크인) 횟수 */
export async function getMemberVisitCounts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("member_visits")
    .select("member_id")
    .eq("venue_id", await getActiveVenueId());

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.member_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function getActiveVisitMemberIds(): Promise<Set<string>> {
  const visits = await getActiveMemberVisits();
  return new Set(visits.map((v) => v.member_id));
}

/** @deprecated */
export const getVenuePlayers = getMembers;

export async function getActiveMemberVisits() {
  if (!isSupabaseConfigured()) return [] as MemberVisitWithMember[];

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("venue_sessions")
    .select("id")
    .eq("venue_id", await getActiveVenueId())
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
    .eq("venue_id", await getActiveVenueId())
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
