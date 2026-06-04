/** Supabase Auth용 내부 이메일 도메인 (실제 메일 발송 없음) */
export const STAFF_AUTH_EMAIL_DOMAIN = "auth.mnf.local";

export function normalizeStaffLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidStaffLoginId(id: string): boolean {
  return /^[a-z0-9_]{3,32}$/.test(id);
}

/** 직원·관리자 로그인 아이디 → Supabase signIn 이메일 */
export function loginIdToAuthEmail(loginId: string): string {
  return `${normalizeStaffLoginId(loginId)}@${STAFF_AUTH_EMAIL_DOMAIN}`;
}

/** 아이디 또는 기존 이메일(레거시) 로그인 — 첫 후보만 (단일 시도용) */
export function resolveSignInEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return loginIdToAuthEmail(trimmed);
}

/** 아이디 로그인 시 시도할 Auth 이메일 목록 (신규 → 레거시) */
export function getSignInEmailCandidates(input: string): string[] {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return [];
  if (trimmed.includes("@")) return [trimmed];

  const loginId = normalizeStaffLoginId(trimmed);
  const candidates = [
    loginIdToAuthEmail(loginId),
    `${loginId}@mnf.com`,
    `${loginId}@mnf.local`,
  ];
  return [...new Set(candidates)];
}

export function displayLoginFromAuthEmail(email: string | null | undefined): string {
  if (!email) return "";
  const domain = `@${STAFF_AUTH_EMAIL_DOMAIN}`;
  if (email.endsWith(domain)) return email.slice(0, -domain.length);
  return email;
}
