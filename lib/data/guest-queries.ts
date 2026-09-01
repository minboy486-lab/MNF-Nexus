import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { resolveGuestMember } from "@/lib/guest/member-for-user";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import type { ApprovalRequest, Game, Member, PointTransferRequest } from "@/lib/types";

export async function getGuestMember() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return resolveGuestMember(supabase, user.id);
}

export async function getGuestPointHistory(memberId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("money_transactions")
    .select("*")
    .eq("member_id", memberId)
    .in("txn_type", ["point_spend", "point_earn", "buy_in", "rebuy"])
    .order("occurred_at", { ascending: false })
    .limit(30);

  return data ?? [];
}

export async function getGuestRecentPlacements(memberId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("game_finish_placements")
    .select("*, games(id, daily_game_number, game_presets(name))")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(10);

  return data ?? [];
}

export async function getGuestPendingRequests(memberId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getGuestPointTransfers(memberId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("point_transfer_requests")
    .select("*")
    .or(`from_member_id.eq.${memberId},to_member_id.eq.${memberId}`)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []) as PointTransferRequest[];
}

export async function getRunningGamesForGuest() {
  if (!isSupabaseConfigured()) return [] as Game[];

  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("id, daily_game_number, status, game_presets(name)")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .in("status", ["running", "registration_closed"])
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getGuestWinPointsTotal(memberId: string) {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  const { data } = await supabase
    .from("win_point_ledger")
    .select("points")
    .eq("member_id", memberId);

  return (data ?? []).reduce((s, r) => s + r.points, 0);
}

export async function getPendingStaffRequests() {
  if (!isSupabaseConfigured()) return { approvals: [] as ApprovalRequest[], transfers: [] as PointTransferRequest[] };

  const supabase = await createClient();
  const { data: approvals } = await supabase
    .from("approval_requests")
    .select("*, members(*)")
    .eq("status", "pending")
    .in("request_type", ["reservation", "buy_in_request", "seat_reservation", "participation", "buy_in"])
    .order("created_at", { ascending: false });

  const { data: transfers } = await supabase
    .from("point_transfer_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return {
    approvals: (approvals ?? []) as ApprovalRequest[],
    transfers: (transfers ?? []) as PointTransferRequest[],
  };
}
