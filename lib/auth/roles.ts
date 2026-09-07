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

/** 손님 관리(포인트·방문·손님계정): 관리자·매니저 */
export function canManageGuests(role: string | null | undefined): boolean {
  return isManagerOrAdmin(role);
}

/** 역할별 관리자 사이드바·경로 접근 */
export type AdminNavAccess = {
  scores: boolean;
  guests: boolean;
  presets: boolean;
  accounts: boolean;
  /** 대시보드·테이블·정산·직원 등 나머지 전체 */
  fullAdmin: boolean;
};

export function getAdminNavAccess(role: string | null | undefined): AdminNavAccess {
  if (isAdminRole(role)) {
    return {
      scores: true,
      guests: true,
      presets: true,
      accounts: true,
      fullAdmin: true,
    };
  }
  if (role === "manager") {
    return {
      scores: true,
      guests: true,
      presets: true,
      accounts: true,
      fullAdmin: false,
    };
  }
  if (role === "staff") {
    return {
      scores: true,
      guests: false,
      presets: false,
      accounts: false,
      fullAdmin: false,
    };
  }
  return {
    scores: false,
    guests: false,
    presets: false,
    accounts: false,
    fullAdmin: false,
  };
}

/** 역할별 관리자 홈 (메뉴에 있는 첫 화면) */
export function getAdminHomePath(role: string | null | undefined): string {
  if (isAdminRole(role)) return "/admin/dashboard";
  if (role === "manager" || role === "staff") return "/admin/scores";
  return "/login";
}

/** /admin 하위 경로 접근 가능 여부 */
export function canAccessAdminPath(
  role: string | null | undefined,
  pathname: string,
): boolean {
  if (!canAccessAdminArea(role)) return false;
  if (isAdminRole(role)) return true;

  const access = getAdminNavAccess(role);
  if (pathname === "/admin" || pathname === "/admin/") return access.scores;
  if (pathname.startsWith("/admin/scores")) return access.scores;
  if (pathname.startsWith("/admin/guests")) return access.guests;
  if (pathname.startsWith("/admin/presets")) return access.presets;
  if (pathname.startsWith("/admin/accounts")) return access.accounts;
  return false;
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
