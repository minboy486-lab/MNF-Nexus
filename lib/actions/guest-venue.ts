"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  GUEST_VENUE_COOKIE,
  guestVenueCookieOptions,
  listGuestVenueIdsForUser,
} from "@/lib/guest/venue";
import { isKnownVenueId } from "@/lib/venue/constants";

export async function switchGuestVenue(
  venueId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!isKnownVenueId(venueId)) return { error: "알 수 없는 지점입니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const allowed = await listGuestVenueIdsForUser(supabase, user.id);
  if (!allowed.includes(venueId)) {
    return { error: "이 지점에 등록된 손님 정보가 없습니다." };
  }

  const cookieStore = await cookies();
  cookieStore.set(GUEST_VENUE_COOKIE, venueId, guestVenueCookieOptions());

  revalidatePath("/guest", "layout");
  return { ok: true };
}
