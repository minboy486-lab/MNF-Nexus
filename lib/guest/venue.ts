import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "@/lib/types";
import {
  KNOWN_VENUES,
  YEOKSAM_VENUE_ID,
  isKnownVenueId,
  type KnownVenue,
} from "@/lib/venue/constants";

export const GUEST_VENUE_COOKIE = "mnf_guest_venue";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

function uniqueVenueIds(ids: (string | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || !isKnownVenueId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 로그인 손님 계정에 연결된 지점 목록 (members.user_id 기준) */
export async function listGuestVenueIdsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("members")
    .select("venue_id")
    .eq("user_id", userId)
    .not("venue_id", "is", null);

  return uniqueVenueIds((data ?? []).map((r) => r.venue_id as string));
}

export async function listGuestVenuesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<KnownVenue[]> {
  const ids = await listGuestVenueIdsForUser(supabase, userId);
  return KNOWN_VENUES.filter((v) => ids.includes(v.id));
}

export async function getActiveGuestVenueId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const allowed = await listGuestVenueIdsForUser(supabase, userId);
  if (allowed.length === 0) return YEOKSAM_VENUE_ID;

  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(GUEST_VENUE_COOKIE)?.value;
    if (cookie && allowed.includes(cookie)) return cookie;
  } catch {
    /* cookies() unavailable */
  }

  return allowed[0] ?? YEOKSAM_VENUE_ID;
}

/** 선택 지점의 손님 members 행 (포인트·승점·이벤트는 지점별로 독립) */
export async function resolveGuestMember(
  supabase: SupabaseClient,
  userId: string,
  venueId: string,
): Promise<Member | null> {
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .eq("venue_id", venueId)
    .maybeSingle();

  return data ? (data as Member) : null;
}

export function guestVenueCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}
