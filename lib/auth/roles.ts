import type { UserRole } from "@/lib/types";
import { KNOWN_VENUE_IDS } from "@/lib/venue/constants";

export const PROFILE_ROLES: UserRole[] = [
  "admin",
  "manager",
  "staff",
  "guest",
  "screen",
];

/** 계정 관리에서 생성·수정 가능한 역할 (스크린 제외) */
export const ACCOUNT_MANAGE_ROLES: UserRole[] = ["admin", "manager", "staff"];

export const PROFILE_ROLE_LABELS: Record<UserRole, string> = {
  admin: "관리자",
  manager: "매니저",
  staff: "직원",
  guest: "손님",
  screen: "스크린",
  counter: "스크린",
};

export function getRoleLabel(role: string): string {
  return PROFILE_ROLE_LABELS[role as UserRole] ?? role;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export function isManagerOrAdmin(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager";
}

export function isStaffLikeRole(role: string | null | undefined): boolean {
  return role === "staff";
}

export function isScreenRole(role: string | null | undefined): boolean {
  return role === "screen" || role === "counter";
}

export function canAccessAdminArea(role: string | null | undefined): boolean {
  return isAdminRole(role) || isManagerOrAdmin(role) || role === "staff";
}

/** 계정 관리 메뉴·API: 관리자·매니저 */
export function canManageAccounts(role: string | null | undefined): boolean {
  return isManagerOrAdmin(role);
}

/** 높을수록 상위. guest/screen 등은 0 */
export function accountRoleRank(role: string | null | undefined): number {
  if (role === "admin") return 3;
  if (role === "manager") return 2;
  if (role === "staff") return 1;
  return 0;
}

/** 목록에 표시 가능: 본인보다 높은 역할은 숨김 */
export function canViewAccountRole(
  viewerRole: string | null | undefined,
  targetRole: string | null | undefined,
): boolean {
  if (isScreenRole(targetRole) || targetRole === "guest") return false;
  if (!ACCOUNT_MANAGE_ROLES.includes(targetRole as UserRole)) return false;
  return accountRoleRank(targetRole) <= accountRoleRank(viewerRole);
}

/** 생성·수정 시 부여 가능한 역할 */
export function assignableRolesFor(viewerRole: string | null | undefined): UserRole[] {
  if (isAdminRole(viewerRole)) return [...ACCOUNT_MANAGE_ROLES];
  if (viewerRole === "manager") return ["manager", "staff"];
  return [];
}

export function canAssignAccountRole(
  viewerRole: string | null | undefined,
  targetRole: string | null | undefined,
): boolean {
  if (!targetRole) return false;
  return assignableRolesFor(viewerRole).includes(targetRole as UserRole);
}

/** 양 지점 모두 보유 */
export function hasAllKnownVenues(venueIds: string[] | null | undefined): boolean {
  const set = new Set(venueIds ?? []);
  return KNOWN_VENUE_IDS.every((id) => set.has(id));
}

/** 양 지점 관리자만 타 지점 계정까지 목록에 포함 */
export function canSeeAllVenueAccounts(
  viewerRole: string | null | undefined,
  venueIds: string[] | null | undefined,
): boolean {
  return isAdminRole(viewerRole) && hasAllKnownVenues(venueIds);
}

export function venuesIntersect(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const set = new Set(b);
  return a.some((id) => set.has(id));
}
