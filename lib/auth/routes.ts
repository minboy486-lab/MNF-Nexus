import { isScreenRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";

/** 태블릿·iPad 등 접수대 단말로 보이는 UA */
export function isTabletUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent;
  if (/iPad|Tablet|PlayBook|Silk|KFAPWI|SM-T/i.test(ua)) return true;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && /Mobile/i.test(ua)) return true;
  return false;
}

export function getHomePath(role: UserRole | string | undefined | null): string {
  switch (role) {
    case "screen":
    case "counter":
      return "/tv";
    case "guest":
      return "/guest";
    case "staff":
      return "/staff/tables";
    case "manager":
    case "admin":
      return "/admin/dashboard";
    default:
      return "/login";
  }
}

/** 접수대 계정은 태블릿에서만 접수 화면, 그 외 단말은 안내 */
export function getCounterRedirectPath(
  role: UserRole | string | undefined | null,
  userAgent: string | null | undefined,
): string {
  if (!isScreenRole(role)) return getHomePath(role);
  return "/tv";
}

export function isCounterRole(role: string | undefined | null): boolean {
  return isScreenRole(role);
}
