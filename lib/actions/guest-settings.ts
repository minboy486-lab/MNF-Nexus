"use server";

import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/auth/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export async function changeGuestPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: true } | { error: string }> {
  const current = payload.currentPassword;
  const next = payload.newPassword;
  if (!current) return { error: "현재 비밀번호를 입력하세요." };
  if (!next || next.length < 6) return { error: "새 비밀번호는 6자 이상이어야 합니다." };
  if (current === next) return { error: "새 비밀번호가 현재와 같습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "로그인이 필요합니다." };

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (verifyError) return { error: "현재 비밀번호가 올바르지 않습니다." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };

  if (isSupabaseAdminConfigured()) {
    const admin = createAdminClient();
    const passwordHash = await hashPassword(next);
    await admin
      .from("members")
      .update({ password_hash: passwordHash })
      .eq("user_id", user.id);
  }

  revalidatePath("/guest");
  revalidatePath("/guest/settings");
  return { success: true };
}
