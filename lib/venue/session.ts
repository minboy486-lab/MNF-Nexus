import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenueId } from "@/lib/venue/active";
import { YEOKSAM_VENUE_ID } from "@/lib/venue/constants";
import type { VenueSession } from "@/lib/types";

export async function getDefaultVenueId() {
  return getActiveVenueId();
}

export async function getOpenVenueSession(
  venueId?: string,
): Promise<VenueSession | null> {
  if (!isSupabaseConfigured()) return null;

  const id = venueId ?? (await getActiveVenueId());
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_sessions")
    .select("*")
    .eq("venue_id", id)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as VenueSession | null;
}

export async function requireOpenSession(venueId?: string) {
  const id = venueId ?? (await getActiveVenueId());
  const session = await getOpenVenueSession(id);
  if (!session) {
    return { error: "영업이 열려 있지 않습니다. 관리자 대시보드에서 「영업 시작」을 눌러 주세요." as const };
  }
  return { session };
}

/** 손님 공개 페이지 등 지점 전환 범위 밖 */
export function publicVenueId() {
  return YEOKSAM_VENUE_ID;
}
