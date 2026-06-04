import type { UserRole } from "@/lib/types";

export const PROFILE_ROLES: UserRole[] = [
  "admin",
  "manager",
  "staff",
  "guest",
  "screen",
];

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

export function canManageAccounts(role: string | null | undefined): boolean {
  return isAdminRole(role);
}
