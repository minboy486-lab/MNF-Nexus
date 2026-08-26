import {
  type HighHandEntry,
} from "@/lib/events/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicReadClient } from "@/lib/supabase/public-read";
import { getActiveVenueId } from "@/lib/venue/active";

export async function getHighHandsForDate(
  playDate: string,
  venueId?: string,
): Promise<HighHandEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const vid = venueId ?? (await getActiveVenueId());
  const supabase = await createPublicReadClient();
  const { data } = await supabase
    .from("high_hand_daily")
    .select("*")
    .eq("venue_id", vid)
    .eq("play_date", playDate)
    .order("hand_type", { ascending: true });

  return (data ?? []) as HighHandEntry[];
}
