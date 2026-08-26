import type { SupabaseClient } from "@supabase/supabase-js";
import { YEOKSAM_VENUE_ID } from "@/lib/venue/constants";

export async function ensureVenueStaffRow(
  admin: SupabaseClient,
  params: {
    profileId: string;
    name: string;
    role?: "staff" | "manager" | "dealer";
    hourlyWage?: number;
    venueId: string;
  },
): Promise<{ error?: string }> {
  const venueId = params.venueId || YEOKSAM_VENUE_ID;
  const { data: existing } = await admin
    .from("staff")
    .select("id")
    .eq("profile_id", params.profileId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (params.name) patch.name = params.name;
    if (params.hourlyWage != null && params.hourlyWage >= 0) patch.hourly_wage = params.hourlyWage;
    if (params.role) patch.role = params.role;
    if (Object.keys(patch).length) {
      const { error } = await admin.from("staff").update(patch).eq("id", existing.id);
      if (error) return { error: error.message };
    }
    return {};
  }

  const { error } = await admin.from("staff").insert({
    venue_id: venueId,
    profile_id: params.profileId,
    name: params.name.trim() || "직원",
    role: params.role ?? "staff",
    hourly_wage: params.hourlyWage ?? 0,
    is_active: true,
  });
  if (error) return { error: error.message };
  return {};
}

export async function syncStaffRowsForVenues(
  admin: SupabaseClient,
  params: {
    profileId: string;
    name: string;
    role?: "staff" | "manager" | "dealer";
    venueIds: string[];
  },
): Promise<{ error?: string }> {
  for (const venueId of params.venueIds) {
    const result = await ensureVenueStaffRow(admin, { ...params, venueId });
    if (result.error) return result;
  }
  return {};
}
