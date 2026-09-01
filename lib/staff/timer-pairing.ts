export const STAFF_TIMER_PAIRING_KEY = "mnf-staff-timer-pairing";
export const CONTROLLER_REMOTE_PORT = 17890;
const PAIRING_COOKIE = "mnf-staff-timer-pairing";

export type StaffTimerPairing = {
  url: string;
  pin: string;
  tok: string;
  loginId: string;
  /** QR에 포함된 LAN IP 후보 (최신 주소 우선 연결용) */
  urls?: string[];
};

export function parseLanIpList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const ip = part.trim();
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);
    out.push(ip);
  }
  return out;
}

function baseUrlFromIp(ip: string, port = CONTROLLER_REMOTE_PORT): string | null {
  try {
    const host = ip.trim();
    if (!host || !isPrivateLanHostname(host)) return null;
    return `http://${host}:${port}`;
  } catch {
    return null;
  }
}

export function baseUrlsFromPairing(pairing: Pick<StaffTimerPairing, "url" | "urls">): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    try {
      const u = new URL(raw);
      const base = `${u.protocol}//${u.host}`;
      if (seen.has(base)) return;
      seen.add(base);
      out.push(base);
    } catch {
      /* ignore */
    }
  };
  for (const ip of pairing.urls ?? []) push(baseUrlFromIp(ip));
  push(pairing.url);
  return out;
}

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

export function parseControllerQr(text: string): { pin: string; tok: string; url: string; urls: string[] } | null {
  try {
    const u = new URL(text.trim());
    const pin = u.searchParams.get("pin")?.trim() ?? "";
    const tok = u.searchParams.get("tok")?.trim() ?? "";
    if (!pin && !tok) return null;
    const url = u.toString();
    if (!isLanControllerUrl(url)) return null;
    const fromParam = parseLanIpList(u.searchParams.get("ips"));
    const fromHost = u.hostname && isPrivateLanHostname(u.hostname) ? [u.hostname] : [];
    const urls = [...fromParam, ...fromHost.filter((ip) => !fromParam.includes(ip))];
    return { pin, tok, url, urls };
  } catch {
    return null;
  }
}

function cookiePairing(): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  const row = parts.find((p) => p.startsWith(`${PAIRING_COOKIE}=`));
  if (!row) return null;
  try {
    return decodeURIComponent(row.slice(PAIRING_COOKIE.length + 1));
  } catch {
    return null;
  }
}

export function readTimerPairingRaw(): string | null {
  if (typeof window === "undefined") return null;
  const ls = localStorage.getItem(STAFF_TIMER_PAIRING_KEY);
  if (ls) return ls;
  const fromCookie = cookiePairing();
  if (fromCookie) {
    localStorage.setItem(STAFF_TIMER_PAIRING_KEY, fromCookie);
    return fromCookie;
  }
  return null;
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
  const raw = JSON.stringify(pairing);
  localStorage.setItem(STAFF_TIMER_PAIRING_KEY, raw);
  document.cookie = `${PAIRING_COOKIE}=${encodeURIComponent(raw)}; path=/; max-age=${60 * 60 * 18}; SameSite=Lax`;
  window.dispatchEvent(new Event("mnf-timer-pairing"));
}

export function clearTimerPairing(): void {
  localStorage.removeItem(STAFF_TIMER_PAIRING_KEY);
  document.cookie = `${PAIRING_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  window.dispatchEvent(new Event("mnf-timer-pairing"));
}

export function subscribeTimerPairing(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("mnf-timer-pairing", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("mnf-timer-pairing", onChange);
  };
}

export const CLOCK_IN_HOME_KEY = "mnf-clock-in-go-home";

export function markClockInGoHome(): void {
  sessionStorage.setItem(CLOCK_IN_HOME_KEY, "1");
}

export function consumeClockInGoHome(): boolean {
  const v = sessionStorage.getItem(CLOCK_IN_HOME_KEY);
  sessionStorage.removeItem(CLOCK_IN_HOME_KEY);
  return v === "1";
}

export function hasClockInGoHome(): boolean {
  return sessionStorage.getItem(CLOCK_IN_HOME_KEY) === "1";
}

/** 출근 이후 매장 컨트롤용. tok/next 없이 PIN+아이디만 넘긴다. */
export function timerRemoteHref(
  pairing: StaffTimerPairing,
  opts?: { baseUrl?: string; loginId?: string },
): string {
  try {
    const base = opts?.baseUrl ?? pairing.url;
    const u = new URL(base);
    u.searchParams.delete("tok");
    u.searchParams.delete("next");
    u.searchParams.delete("ips");
    const pin = pairing.pin || u.searchParams.get("pin") || "";
    if (pin) u.searchParams.set("pin", pin);
    const loginId = opts?.loginId ?? pairing.loginId;
    if (loginId) u.searchParams.set("id", loginId);
    if (typeof window !== "undefined" && window.location.origin) {
      u.searchParams.set("from", window.location.origin);
    }
    return u.toString();
  } catch {
    return pairing.url;
  }
}

export function resolveControllerConnectUrls(
  pairing: StaffTimerPairing,
  cloud?: { ips: string[]; port: number; pin: string; fresh: boolean } | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const pushBase = (base: string | null | undefined) => {
    if (!base || seen.has(base)) return;
    seen.add(base);
    out.push(base);
  };

  if (cloud?.fresh) {
    for (const ip of cloud.ips) pushBase(baseUrlFromIp(ip, cloud.port));
    if (cloud.pin) pairing = { ...pairing, pin: cloud.pin };
  }

  for (const base of baseUrlsFromPairing(pairing)) pushBase(base);
  return out.map((base) => timerRemoteHref(pairing, { baseUrl: `${base}/remote/` }));
}

export function isLikelyCellularConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { type?: string } }).connection;
  return conn?.type === "cellular";
}

export function pairingUrlWithoutTok(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("tok");
    u.searchParams.delete("next");
    return u.toString();
  } catch {
    return url;
  }
}
