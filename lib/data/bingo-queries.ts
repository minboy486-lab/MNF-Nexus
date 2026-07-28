import { DEFAULT_BINGO_MISSIONS, type BingoMark, type BingoMonthSheet } from "@/lib/events/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicReadClient } from "@/lib/supabase/public-read";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";

function normalizeLabels(raw: unknown): string[] {
  const labels = Array.isArray(raw) ? raw.map(String) : [];
  return Array.from({ length: 16 }, (_, i) => labels[i]?.trim() || DEFAULT_BINGO_MISSIONS[i]);
}

export async function getBingoMonthSheet(monthKey: string): Promise<BingoMonthSheet> {
  const fallback: BingoMonthSheet = {
    month_key: monthKey,
    cell_labels: [...DEFAULT_BINGO_MISSIONS],
    marks: [],
  };

  if (!isSupabaseConfigured()) return fallback;

  const supabase = await createPublicReadClient();

  const [{ data: settings }, { data: marks }] = await Promise.all([
    supabase
      .from("bingo_month_settings")
      .select("cell_labels")
      .eq("venue_id", DEFAULT_VENUE_ID)
      .eq("month_key", monthKey)
      .maybeSingle(),
    supabase
      .from("bingo_marks")
      .select("*")
      .eq("venue_id", DEFAULT_VENUE_ID)
      .eq("month_key", monthKey)
      .order("cell_no", { ascending: true })
      .order("nickname", { ascending: true }),
  ]);

  return {
    month_key: monthKey,
    cell_labels: settings?.cell_labels ? normalizeLabels(settings.cell_labels) : [...DEFAULT_BINGO_MISSIONS],
    marks: (marks ?? []) as BingoMark[],
  };
}
