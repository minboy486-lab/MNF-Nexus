export const STAFF_TIMER_PAIRING_KEY = "mnf-staff-timer-pairing";
export const CONTROLLER_REMOTE_PORT = 17890;
export const LAN_WIFI_ERROR = "매장 와이파이에 연결한 뒤 다시 스캔해 주세요";

export type StaffTimerPairing = {
  url: string;
  pin: string;
  tok: string;
  loginId: string;
};

export function isPrivateLanHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local")) return true;
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** 컨트롤러 QR은 매장 PC의 LAN 주소(http://192.168.x.x:17890/...)만 인정한다. */
export function isLanControllerUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:") return false;
    const port = u.port ? Number(u.port) : 80;
    if (port !== CONTROLLER_REMOTE_PORT) return false;
    return isPrivateLanHostname(u.hostname);
  } catch {
    return false;
  }
}

export function parseControllerQr(text: string): { pin: string; tok: string; url: string } | null {
  try {
    const u = new URL(text.trim());
    const pin = u.searchParams.get("pin")?.trim() ?? "";
    const tok = u.searchParams.get("tok")?.trim() ?? "";
    if (!pin && !tok) return null;
    const url = u.toString();
    if (!isLanControllerUrl(url)) return null;
    return { pin, tok, url };
  } catch {
    return null;
  }
}

export function readTimerPairingRaw(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STAFF_TIMER_PAIRING_KEY);
}

export function readTimerPairing(): StaffTimerPairing | null {
  const raw = readTimerPairingRaw();
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as StaffTimerPairing;
    if (!v?.url || !isLanControllerUrl(v.url)) return null;
    return v;
  } catch {
    return null;
  }
}

export function saveTimerPairing(pairing: StaffTimerPairing): void {
  localStorage.setItem(STAFF_TIMER_PAIRING_KEY, JSON.stringify(pairing));
}

export function clearTimerPairing(): void {
  localStorage.removeItem(STAFF_TIMER_PAIRING_KEY);
}

export function subscribeTimerPairing(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export const STAFF_LAN_NAV_KEY = "mnf-staff-lan-nav";

export function markLanNavigation(): void {
  sessionStorage.setItem(STAFF_LAN_NAV_KEY, String(Date.now()));
}

/** 컨트롤러 연결에 실패하고 바로 돌아온 경우 */
export function consumeFailedLanNavigation(windowMs = 60_000): boolean {
  const raw = sessionStorage.getItem(STAFF_LAN_NAV_KEY);
  if (!raw) return false;
  const t = Number(raw);
  sessionStorage.removeItem(STAFF_LAN_NAV_KEY);
  return Number.isFinite(t) && Date.now() - t < windowMs;
}

export function timerRemoteHref(
  pairing: StaffTimerPairing,
  mode: "clock-in" | "resume" = "resume",
): string {
  try {
    const u = new URL(pairing.url);
    u.searchParams.delete("tok");
    if (pairing.pin) u.searchParams.set("pin", pairing.pin);
    if (mode === "clock-in" && pairing.tok) u.searchParams.set("tok", pairing.tok);
    if (pairing.loginId) u.searchParams.set("id", pairing.loginId);
    if (typeof window !== "undefined" && window.location.origin) {
      u.searchParams.set("from", window.location.origin);
    }
    return u.toString();
  } catch {
    return pairing.url;
  }
}

export function pairingUrlWithoutTok(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("tok");
    return u.toString();
  } catch {
    return url;
  }
}
