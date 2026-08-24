"use server";

import { revalidatePath } from "next/cache";
import { canManageAccounts } from "@/lib/auth/roles";
import { getProfileRole } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import {
  displayLoginFromAuthEmail,
  isValidStaffLoginId,
  loginIdToAuthEmail,
  normalizeStaffLoginId,
} from "@/lib/auth/staff-login";
import type { UserRole } from "@/lib/types";
import { PROFILE_ROLES } from "@/lib/auth/roles";
import { ensureVenueStaffRow } from "@/lib/staff/ensure-row";

export type AccountRow = {
  id: string;
  login_id: string;
  display_name: string | null;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
};

type AccountAdminGate =
  | { error: string }
  | { user: { id: string } };

async function requireAccountAdmin(): Promise<AccountAdminGate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const role = await getProfileRole(user.id);
  if (!canManageAccounts(role)) {
    return { error: "관리자만 계정을 관리할 수 있습니다." };
  }
  if (!isSupabaseAdminConfigured()) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다. Supabase 대시보드 → Settings → API에서 service_role 키를 추가하세요.",
    };
  }
  return { user: { id: user.id } };
}

export async function listAccounts(): Promise<
  { accounts: AccountRow[] } | { error: string }
> {
  const gate = await requireAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const admin = createAdminClient();
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    perPage: 500,
  });
  if (listError) return { error: listError.message };

  const ids = listData.users.map((u) => u.id);
  const { data: profiles, error: profError } = await admin
    .from("profiles")
    .select("id, role, display_name, login_id, created_at")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  if (profError) return { error: profError.message };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const accounts: AccountRow[] = listData.users.map((u) => {
    const p = profileMap.get(u.id);
    const metaName =
      typeof u.user_metadata?.display_name === "string"
        ? u.user_metadata.display_name
        : null;
    const loginId =
      p?.login_id ??
      (typeof u.user_metadata?.login_id === "string" ? u.user_metadata.login_id : null) ??
      displayLoginFromAuthEmail(u.email);

    return {
      id: u.id,
      login_id: loginId,
      display_name: p?.display_name ?? metaName,
      role: (p?.role ?? "guest") as UserRole,
      created_at: p?.created_at ?? u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    };
  });

  accounts.sort((a, b) => a.login_id.localeCompare(b.login_id, "ko"));
  return { accounts };
}

export async function createAccount(payload: {
  login_id: string;
  password: string;
  display_name: string;
  role: UserRole;
}): Promise<{ success: true } | { error: string }> {
  const gate = await requireAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const loginId = normalizeStaffLoginId(payload.login_id);
  const password = payload.password;
  const displayName = payload.display_name.trim();
  const role = payload.role;

  if (!loginId || !password || password.length < 6) {
    return { error: "아이디와 비밀번호(6자 이상)를 입력하세요." };
  }
  if (!isValidStaffLoginId(loginId)) {
    return { error: "아이디는 영문 소문자·숫자·_(3~32자)만 사용할 수 있습니다." };
  }
  if (!PROFILE_ROLES.includes(role)) {
    return { error: "유효하지 않은 권한입니다." };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("login_id", loginId)
    .maybeSingle();
  if (existing) return { error: "이미 사용 중인 아이디입니다." };

  const authEmail = loginIdToAuthEmail(loginId);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, login_id: loginId },
  });
  if (createError) return { error: createError.message };
  if (!created.user) return { error: "계정 생성에 실패했습니다." };

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role,
      display_name: displayName || null,
      login_id: loginId,
    })
    .eq("id", created.user.id);

  if (profileError) return { error: profileError.message };

  if (role === "staff" || role === "manager") {
    const staffErr = await ensureVenueStaffRow(admin, {
      profileId: created.user.id,
      name: displayName || loginId,
      role: role === "manager" ? "manager" : "staff",
    });
    if (staffErr.error) return { error: staffErr.error };
    revalidatePath("/admin/staff");
  }

  revalidatePath("/admin/accounts");
  return { success: true };
}

export async function updateAccount(payload: {
  userId: string;
  role: UserRole;
  display_name: string;
  password?: string;
}): Promise<{ success: true } | { error: string }> {
  const gate = await requireAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  const { userId, role, display_name, password } = payload;
  if (!PROFILE_ROLES.includes(role)) {
    return { error: "유효하지 않은 권한입니다." };
  }
  if (userId === gate.user.id && role !== "admin") {
    return { error: "본인 계정의 관리자 권한은 해제할 수 없습니다." };
  }

  const admin = createAdminClient();

  if (password && password.length >= 6) {
    const { error: pwError } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (pwError) return { error: pwError.message };
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { display_name: display_name.trim() },
  });
  if (metaError) return { error: metaError.message };

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role,
      display_name: display_name.trim() || null,
    })
    .eq("id", userId);

  if (profileError) return { error: profileError.message };

  if (role === "staff" || role === "manager") {
    await ensureVenueStaffRow(admin, {
      profileId: userId,
      name: display_name.trim() || "직원",
      role: role === "manager" ? "manager" : "staff",
    });
    revalidatePath("/admin/staff");
  }

  revalidatePath("/admin/accounts");
  return { success: true };
}

export async function deleteAccount(userId: string): Promise<
  { success: true } | { error: string }
> {
  const gate = await requireAccountAdmin();
  if ("error" in gate) return { error: gate.error };

  if (userId === gate.user.id) {
    return { error: "로그인 중인 계정은 삭제할 수 없습니다." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/accounts");
  return { success: true };
}
