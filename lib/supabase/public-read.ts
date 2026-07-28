import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** 손님 공개 페이지용 읽기 — service role 우선( RLS 우회 ), 없으면 anon */
export async function createPublicReadClient() {
  if (isSupabaseAdminConfigured()) {
    return createAdminClient();
  }
  return createClient();
}
