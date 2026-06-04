"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getSignInEmailCandidates,
  isValidStaffLoginId,
  normalizeStaffLoginId,
} from "@/lib/auth/staff-login";
import { getProfileRole } from "@/lib/auth/profile";
import { getCounterRedirectPath } from "@/lib/auth/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

async function resolveSignInEmails(loginInput: string): Promise<string[]> {
  const candidates = getSignInEmailCandidates(loginInput);
  const loginId = normalizeStaffLoginId(loginInput);

  if (
    isSupabaseAdminConfigured() &&
    loginId &&
    isValidStaffLoginId(loginId) &&
    !loginInput.includes("@")
  ) {
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("login_id", loginId)
        .maybeSingle();

      if (profile?.id) {
        const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
        if (authUser.user?.email) {
          candidates.unshift(authUser.user.email.toLowerCase());
        }
      }
    } catch {
      /* service role 미설정 등 — 후보만 사용 */
    }
  }

  return [...new Set(candidates.map((e) => e.toLowerCase()))];
}

async function ensureProfileLoginId(userId: string, loginInput: string) {
  if (loginInput.includes("@") || !isSupabaseAdminConfigured()) return;
  const loginId = normalizeStaffLoginId(loginInput);
  if (!isValidStaffLoginId(loginId)) return;

  try {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ login_id: loginId })
      .eq("id", userId)
      .is("login_id", null);
  } catch {
    /* 무시 */
  }
}

export async function signIn(formData: FormData) {
  const loginInput = String(formData.get("loginId") ?? formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const emails = await resolveSignInEmails(loginInput);

  if (emails.length === 0) {
    return { error: "아이디를 입력하세요." };
  }

  const supabase = await createClient();
  let lastError = "Invalid login credentials";

  for (const email of emails) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await ensureProfileLoginId(user.id, loginInput);
      const role = user ? await getProfileRole(user.id) : null;
      const ua = (await headers()).get("user-agent");
      redirect(getCounterRedirectPath(role, ua));
    }
    lastError = error.message;
  }

  return { error: lastError };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
