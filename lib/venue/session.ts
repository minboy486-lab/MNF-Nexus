import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import type { VenueSession } from "@/lib/types";

export async function getDefaultVenueId() {
  return DEFAULT_VENUE_ID;
}

export async function getOpenVenueSession(
  venueId: string = DEFAULT_VENUE_ID,
): Promise<VenueSession | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_sessions")
    .select("*")
    .eq("venue_id", venueId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as VenueSession | null;
}

export async function requireOpenSession(venueId: string = DEFAULT_VENUE_ID) {
  const session = await getOpenVenueSession(venueId);
  if (!session) {
    return { error: "영업이 열려 있지 않습니다. 관리자 대시보드에서 「영업 시작」을 눌러 주세요." as const };
  }
  return { session };
}
