import { cache } from "react";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  KNOWN_VENUE_IDS,
  KNOWN_VENUES,
  VENUE_COOKIE,
  YEOKSAM_VENUE_ID,
  isKnownVenueId,
  type KnownVenue,
} from "@/lib/venue/constants";

export type AccessibleVenue = KnownVenue;

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!isKnownVenueId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export const listAccessibleVenueIds = cache(async (): Promise<string[]> => {
  if (!isSupabaseConfigured()) return [...KNOWN_VENUE_IDS];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, venue_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "";

  const { data: rows, error } = await supabase
    .from("profile_venues")
    .select("venue_id")
    .eq("profile_id", user.id);

  if (!error && rows?.length) {
    const ids = uniqueIds(rows.map((r) => r.venue_id as string));
    if (ids.length) return ids;
  }

  if (isKnownVenueId(profile?.venue_id)) return [profile.venue_id];
  if (role === "manager" || role === "staff" || role === "screen" || role === "counter") {
    return [YEOKSAM_VENUE_ID];
  }
  return [];
});

export const getActiveVenueId = cache(async (): Promise<string> => {
  const allowed = await listAccessibleVenueIds();
  if (allowed.length === 0) return YEOKSAM_VENUE_ID;

  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(VENUE_COOKIE)?.value;
    if (cookie && allowed.includes(cookie)) return cookie;
  } catch {
    /* cookies() unavailable in some contexts */
  }

  return allowed[0] ?? YEOKSAM_VENUE_ID;
});

export const listAccessibleVenues = cache(async (): Promise<AccessibleVenue[]> => {
  const ids = await listAccessibleVenueIds();
  return KNOWN_VENUES.filter((v) => ids.includes(v.id));
});

export async function userCanAccessVenue(venueId: string): Promise<boolean> {
  const allowed = await listAccessibleVenueIds();
  return allowed.includes(venueId);
}
