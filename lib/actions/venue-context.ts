"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isAdminRole } from "@/lib/auth/roles";
import { getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { listAccessibleVenueIds, userCanAccessVenue } from "@/lib/venue/active";
import { VENUE_COOKIE, isKnownVenueId } from "@/lib/venue/constants";
import { hashControlPin, isControlPin } from "@/lib/venue/control-pin";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export async function switchActiveVenue(venueId: string): Promise<{ ok: true } | { error: string }> {
  if (!isKnownVenueId(venueId)) return { error: "알 수 없는 지점입니다." };
  const allowed = await listAccessibleVenueIds();
  if (!allowed.includes(venueId)) {
    return { error: "이 지점에 대한 권한이 없습니다." };
  }

  const cookieStore = await cookies();
  cookieStore.set(VENUE_COOKIE, venueId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateVenueControlPin(payload: {
  venueId: string;
  pin: string;
}): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase 미연결" };
  if (!isKnownVenueId(payload.venueId)) return { error: "알 수 없는 지점입니다." };
  if (!isControlPin(payload.pin)) return { error: "비밀번호는 숫자 4자리입니다." };
  if (!(await userCanAccessVenue(payload.venueId))) {
    return { error: "이 지점에 대한 권한이 없습니다." };
  }

  const { user, profile } = await getProfile();
  if (!user || !isAdminRole(profile?.role)) {
    return { error: "관리자만 지점 비밀번호를 바꿀 수 있습니다." };
  }
  if (!isSupabaseAdminConfigured()) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY가 필요합니다." };
  }

  const admin = createAdminClient();
  const { data: row, error: readError } = await admin
    .from("venues")
    .select("settings")
    .eq("id", payload.venueId)
    .maybeSingle();
  if (readError) return { error: readError.message };

  const settings =
    row?.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
      ? { ...(row.settings as Record<string, unknown>) }
      : {};
  settings.control_pin = hashControlPin(payload.pin);

  const { error } = await admin
    .from("venues")
    .update({ settings })
    .eq("id", payload.venueId);
  if (error) return { error: error.message };

  revalidatePath("/admin/accounts");
  return { ok: true };
}
