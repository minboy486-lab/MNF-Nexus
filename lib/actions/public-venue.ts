"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  PUBLIC_VENUE_COOKIE,
  publicVenueCookieOptions,
} from "@/lib/ranking/public-venue";
import { isKnownVenueId } from "@/lib/venue/constants";

export async function switchPublicVenue(
  venueId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!isKnownVenueId(venueId)) return { error: "알 수 없는 지점입니다." };

  const cookieStore = await cookies();
  cookieStore.set(PUBLIC_VENUE_COOKIE, venueId, publicVenueCookieOptions());

  revalidatePath("/ranking", "layout");
  return { ok: true };
}
