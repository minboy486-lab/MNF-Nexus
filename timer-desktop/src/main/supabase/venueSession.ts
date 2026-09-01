import { getSupabase } from "./client";
import { getConfiguredVenueId } from "./venue";

export type VenueSessionRow = {
  id: string;
  venue_id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

export async function getOpenVenueSession(venueId?: string): Promise<VenueSessionRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const id = venueId ?? getConfiguredVenueId();
  const { data, error } = await sb
    .from("venue_sessions")
    .select("id, venue_id, status, opened_at, closed_at")
    .eq("venue_id", id)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as VenueSessionRow | null;
}

export async function openVenueSession(venueId?: string): Promise<{ sessionId: string } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase에 연결할 수 없습니다." };
  const id = venueId ?? getConfiguredVenueId();
  const existing = await getOpenVenueSession(id);
  if (existing) return { sessionId: existing.id };
  const { data, error } = await sb
    .from("venue_sessions")
    .insert({ venue_id: id, status: "open" })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { sessionId: data.id };
}

export async function requireOpenVenueSession(venueId?: string): Promise<{ session: VenueSessionRow } | { error: string }> {
  const session = await getOpenVenueSession(venueId);
  if (!session) return { error: "영업이 열려 있지 않습니다. 출석 메뉴에서 「영업 시작」을 눌러 주세요." };
  return { session };
}

export async function closeVenueSession(venueId?: string): Promise<{ ok: true } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase에 연결할 수 없습니다." };
  const id = venueId ?? getConfiguredVenueId();
  const session = await getOpenVenueSession(id);
  if (!session) return { error: "열린 영업 세션이 없습니다." };
  const now = new Date().toISOString();
  const { error } = await sb
    .from("venue_sessions")
    .update({ status: "closed", closed_at: now })
    .eq("id", session.id);
  if (error) return { error: error.message };
  return { ok: true };
}
