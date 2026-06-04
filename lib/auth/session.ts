import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/auth/profile";

export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfileRole(user.id);
}
