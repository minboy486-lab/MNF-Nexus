"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenueId } from "@/lib/venue/active";
import { getOpenVenueSession } from "@/lib/venue/session";

export async function openVenueSession() {
  if (!isSupabaseConfigured()) return { error: "Supabase 미연결" };

  const existing = await getOpenVenueSession();
  if (existing) return { error: "이미 영업 중입니다.", sessionId: existing.id };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("venue_sessions")
    .insert({
      venue_id: await getActiveVenueId(),
      status: "open",
      opened_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/guests");
  revalidatePath("/counter");
  return { sessionId: data.id };
}

export async function closeVenueSession() {
  if (!isSupabaseConfigured()) return { error: "Supabase 미연결" };

  const session = await getOpenVenueSession();
  if (!session) return { error: "열린 영업 세션이 없습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("venue_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user?.id ?? null,
    })
    .eq("id", session.id);

  if (error) return { error: error.message };

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/guests");
  revalidatePath("/counter");
  return { success: true };
}
