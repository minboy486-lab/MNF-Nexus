import { hashPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { revalidatePath } from "next/cache";

export async function ensureMemberByNickname(nickname: string) {
  const nick = nickname.trim();
  if (!nick) return { error: "닉네임을 입력하세요." as const };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("members")
    .select("id, nickname")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("nickname", nick)
    .maybeSingle();

  if (existing) {
    return { memberId: existing.id, nickname: existing.nickname, created: false };
  }

  const loginId = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const passwordHash = await hashPassword("0000");
  const { data, error } = await supabase
    .from("members")
    .insert({
      venue_id: DEFAULT_VENUE_ID,
      login_id: loginId,
      password_hash: passwordHash,
      nickname: nick,
      floor_status: "registered",
    })
    .select("id, nickname")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("members")
        .select("id, nickname")
        .eq("venue_id", DEFAULT_VENUE_ID)
        .eq("nickname", nick)
        .maybeSingle();
      if (retry) return { memberId: retry.id, nickname: retry.nickname, created: false };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/guests");
  return { memberId: data.id, nickname: data.nickname, created: true };
}
