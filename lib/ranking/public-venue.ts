import { cookies } from "next/headers";
import {
  KNOWN_VENUES,
  YEOKSAM_VENUE_ID,
  isKnownVenueId,
  type KnownVenue,
} from "@/lib/venue/constants";

export const PUBLIC_VENUE_COOKIE = "mnf_public_venue";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export function publicVenueCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function getActivePublicVenueId(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(PUBLIC_VENUE_COOKIE)?.value;
    if (cookie && isKnownVenueId(cookie)) return cookie;
  } catch {
    /* cookies() unavailable */
  }
  return YEOKSAM_VENUE_ID;
}

export function listPublicVenues(): KnownVenue[] {
  return [...KNOWN_VENUES];
}
