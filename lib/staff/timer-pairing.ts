export const STAFF_TIMER_PAIRING_KEY = "mnf-staff-timer-pairing";

export type StaffTimerPairing = {
  url: string;
  pin: string;
  tok: string;
  loginId: string;
};

export function parseControllerQr(text: string): { pin: string; tok: string; url: string } | null {
  try {
    const u = new URL(text.trim());
    const pin = u.searchParams.get("pin")?.trim() ?? "";
    const tok = u.searchParams.get("tok")?.trim() ?? "";
    if (!pin && !tok) return null;
    return { pin, tok, url: u.toString() };
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
    if (!v?.url) return null;
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

export function timerRemoteHref(pairing: StaffTimerPairing): string {
  try {
    const u = new URL(pairing.url);
    if (pairing.loginId) u.searchParams.set("id", pairing.loginId);
    return u.toString();
  } catch {
    return pairing.url;
  }
}
