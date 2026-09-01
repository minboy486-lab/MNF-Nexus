import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "@/lib/types";

/** 로그인 사용자에 연동된 손님 회원 (다지점 시 최근 생성 1건). */
export async function resolveGuestMember(
  supabase: SupabaseClient,
  userId: string,
): Promise<Member | null> {
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = data?.[0];
  return row ? (row as Member) : null;
}
