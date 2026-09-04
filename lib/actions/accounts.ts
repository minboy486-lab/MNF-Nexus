"use server";

import { revalidatePath } from "next/cache";
import {
  ACCOUNT_MANAGE_ROLES,
  assignableRolesFor,
  canAssignAccountRole,
  canManageAccounts,
  canSeeAllVenueAccounts,
  canViewAccountRole,
  isScreenRole,
  venuesIntersect,
} from "@/lib/auth/roles";
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
import { syncStaffRowsForVenues } from "@/lib/staff/ensure-row";
import { listAccessibleVenueIds } from "@/lib/venue/active";
import {
  defaultVenuesForRole,
  isKnownVenueId,
} from "@/lib/venue/constants";

export type AccountRow = {
  id: string;
  login_id: string;
  display_name: string | null;
  role: UserRole;
  venue_ids: string[];
  created_at: string;
  last_sign_in_at: string | null;
};

export type AccountViewerContext = {
  role: UserRole;
  venueIds: string[];
  canSeeAllVenues: boolean;
  assignableRoles: UserRole[];
};

type AccountGate =
  | { error: string }
  | {
      user: { id: string };
      role: UserRole;
      venueIds: string[];
      canSeeAllVenues: boolean;
    };

async function requireAccountManager(): Promise<AccountGate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const role = (await getProfileRole(user.id)) as UserRole | null;
  if (!canManageAccounts(role)) {
    return { error: "관리자 또는 매니저만 계정을 관리할 수 있습니다." };
  }
  if (!isSupabaseAdminConfigured()) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다. Supabase 대시보드 → Settings → API에서 service_role 키를 추가하세요.",
    };
  }
  const venueIds = await listAccessibleVenueIds();
  return {
    user: { id: user.id },
    role: (role ?? "staff") as UserRole,
    venueIds,
    canSeeAllVenues: canSeeAllVenueAccounts(role, venueIds),
  };
}

function normalizeAccountVenues(
  role: UserRole,
  requested: string[] | undefined,
  actorVenueIds: string[],
): { venueIds: string[] } | { error: string } {
  if (role === "guest") return { venueIds: [] };
  const venueIds = [...new Set((requested ?? []).filter(isKnownVenueId))];
  if (venueIds.length === 0) {
    return { error: "지점을 하나 이상 선택하세요." };
  }
  const allowed = new Set(actorVenueIds.filter(isKnownVenueId));
  if (venueIds.some((id) => !allowed.has(id))) {
    return { error: "본인에게 없는 지점 권한은 부여할 수 없습니다." };
  }
  return { venueIds };
}

async function replaceProfileVenues(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  venueIds: string[],
): Promise<{ error?: string }> {
  const { error: delError } = await admin.from("profile_venues").delete().eq("profile_id", profileId);
  if (delError) return { error: delError.message };
  if (!venueIds.length) return {};
  const { error } = await admin.from("profile_venues").insert(
    venueIds.map((venue_id) => ({ profile_id: profileId, venue_id })),
  );
  if (error) return { error: error.message };
  return {};
}

async function loadTargetVenues(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  role: string | null | undefined,
): Promise<string[]> {
  const { data: memberships } = await admin
    .from("profile_venues")
    .select("venue_id")
    .eq("profile_id", profileId);
  const ids = (memberships ?? [])
    .map((r) => r.venue_id as string)
    .filter(isKnownVenueId);
  if (ids.length) return ids;
  return defaultVenuesForRole(role);
}

function canManageTargetAccount(
  gate: Exclude<AccountGate, { error: string }>,
  targetRole: string | null | undefined,
  targetVenueIds: string[],
): boolean {
  if (!canViewAccountRole(gate.role, targetRole)) return false;
  if (gate.canSeeAllVenues) return true;
  return venuesIntersect(gate.venueIds, targetVenueIds);
}

export async function getAccountViewerContext(): Promise<
  AccountViewerContext | { error: string }
> {
  const gate = await requireAccountManager();
  if ("error" in gate) return { error: gate.error };
  return {
    role: gate.role,
    venueIds: gate.venueIds,
    canSeeAllVenues: gate.canSeeAllVenues,
    assignableRoles: assignableRolesFor(gate.role),
  };
}

export async function listAccounts(): Promise<
  { accounts: AccountRow[] } | { error: string }
> {
  const gate = await requireAccountManager();
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

  const { data: memberships } = await admin
    .from("profile_venues")
    .select("profile_id, venue_id")
    .in("profile_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const venuesByProfile = new Map<string, string[]>();
  for (const row of memberships ?? []) {
    const list = venuesByProfile.get(row.profile_id) ?? [];
    if (isKnownVenueId(row.venue_id)) list.push(row.venue_id);
    venuesByProfile.set(row.profile_id, list);
  }

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
    const role = (p?.role ?? "guest") as UserRole;
    const venue_ids =
      venuesByProfile.get(u.id)?.length
        ? (venuesByProfile.get(u.id) as string[])
        : defaultVenuesForRole(role);

    return {
      id: u.id,
      login_id: loginId,
      display_name: p?.display_name ?? metaName,
      role,
      venue_ids,
      created_at: p?.created_at ?? u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    };
  });

  const filtered = accounts.filter((a) => {
    if (a.role === "guest" || isScreenRole(a.role)) return false;
    if (!canViewAccountRole(gate.role, a.role)) return false;
    if (gate.canSeeAllVenues) return true;
    return venuesIntersect(gate.venueIds, a.venue_ids);
  });

  filtered.sort((a, b) => a.login_id.localeCompare(b.login_id, "ko"));
  return { accounts: filtered };
}

export async function createAccount(payload: {
  login_id: string;
  password: string;
  display_name: string;
  role: UserRole;
  venue_ids?: string[];
}): Promise<{ success: true } | { error: string }> {
  const gate = await requireAccountManager();
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
  if (!ACCOUNT_MANAGE_ROLES.includes(role) || !canAssignAccountRole(gate.role, role)) {
    return { error: "부여할 수 없는 권한입니다." };
  }
  if (isScreenRole(role)) {
    return { error: "스크린 계정은 더 이상 사용할 수 없습니다." };
  }
  if (role === "guest") {
    return { error: "손님 계정은 손님 관리 → 계정 관리에서 생성하세요." };
  }
  const venues = normalizeAccountVenues(role, payload.venue_ids, gate.venueIds);
  if ("error" in venues) return { error: venues.error };

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

  const pv = await replaceProfileVenues(admin, created.user.id, venues.venueIds);
  if (pv.error) return { error: pv.error };

  if (role === "staff" || role === "manager") {
    const staffErr = await syncStaffRowsForVenues(admin, {
      profileId: created.user.id,
      name: displayName || loginId,
      role: role === "manager" ? "manager" : "staff",
      venueIds: venues.venueIds,
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
  venue_ids?: string[];
}): Promise<{ success: true } | { error: string }> {
  const gate = await requireAccountManager();
  if ("error" in gate) return { error: gate.error };

  const { userId, role, display_name, password } = payload;
  if (!ACCOUNT_MANAGE_ROLES.includes(role) || !canAssignAccountRole(gate.role, role)) {
    return { error: "부여할 수 없는 권한입니다." };
  }
  if (isScreenRole(role)) {
    return { error: "스크린 계정은 더 이상 사용할 수 없습니다." };
  }

  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!existingProfile) return { error: "계정을 찾을 수 없습니다." };
  if (existingProfile.role === "guest") {
    return { error: "손님 계정은 손님 관리 → 계정 관리에서 수정하세요." };
  }
  if (isScreenRole(existingProfile.role)) {
    return { error: "스크린 계정은 더 이상 수정할 수 없습니다." };
  }

  const targetVenues = await loadTargetVenues(admin, userId, existingProfile.role);
  if (!canManageTargetAccount(gate, existingProfile.role, targetVenues)) {
    return { error: "이 계정을 수정할 권한이 없습니다." };
  }

  if (role === "guest") {
    return { error: "손님 계정은 손님 관리 → 계정 관리에서 수정하세요." };
  }
  const venues = normalizeAccountVenues(role, payload.venue_ids, gate.venueIds);
  if ("error" in venues) return { error: venues.error };

  if (userId === gate.user.id && role !== gate.role) {
    return { error: "본인 계정의 권한은 변경할 수 없습니다." };
  }

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

  const pv = await replaceProfileVenues(admin, userId, venues.venueIds);
  if (pv.error) return { error: pv.error };

  if (role === "staff" || role === "manager") {
    await syncStaffRowsForVenues(admin, {
      profileId: userId,
      name: display_name.trim() || "직원",
      role: role === "manager" ? "manager" : "staff",
      venueIds: venues.venueIds,
    });
    revalidatePath("/admin/staff");
  }

  revalidatePath("/admin/accounts");
  return { success: true };
}

export async function deleteAccount(userId: string): Promise<
  { success: true } | { error: string }
> {
  const gate = await requireAccountManager();
  if ("error" in gate) return { error: gate.error };

  if (userId === gate.user.id) {
    return { error: "로그인 중인 계정은 삭제할 수 없습니다." };
  }

  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!existingProfile) return { error: "계정을 찾을 수 없습니다." };

  const targetVenues = await loadTargetVenues(admin, userId, existingProfile.role);
  if (!canManageTargetAccount(gate, existingProfile.role, targetVenues)) {
    return { error: "이 계정을 삭제할 권한이 없습니다." };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/accounts");
  return { success: true };
}
