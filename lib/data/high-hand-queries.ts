import {
  type HighHandEntry,
} from "@/lib/events/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicReadClient } from "@/lib/supabase/public-read";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";

export async function getHighHandsForDate(playDate: string): Promise<HighHandEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createPublicReadClient();
  const { data } = await supabase
    .from("high_hand_daily")
    .select("*")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("play_date", playDate)
    .order("hand_type", { ascending: true });

  return (data ?? []) as HighHandEntry[];
}
