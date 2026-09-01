import { CONTROLLER_REMOTE_PORT } from "@/lib/staff/timer-pairing";

export const VENUE_CONTROLLER_LAN_KEY = "controller_lan";

export type VenueControllerLan = {
  ips: string[];
  port: number;
  pin: string;
  hostname: string;
  updatedAt: string;
};

export function parseVenueControllerLan(raw: unknown): VenueControllerLan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const ips = Array.isArray(o.ips)
    ? o.ips.filter((ip): ip is string => typeof ip === "string" && ip.trim().length > 0)
    : [];
  const pin = typeof o.pin === "string" ? o.pin.trim() : "";
  const port = typeof o.port === "number" && Number.isInteger(o.port) ? o.port : CONTROLLER_REMOTE_PORT;
  const hostname = typeof o.hostname === "string" ? o.hostname.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
  if (!ips.length || !/^\d{4}$/.test(pin)) return null;
  return { ips, port, pin, hostname, updatedAt };
}

export function controllerLanIsFresh(presence: VenueControllerLan, maxAgeMs = 3 * 60 * 1000): boolean {
  const at = Date.parse(presence.updatedAt);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at <= maxAgeMs;
}

export function controllerLanBaseUrls(presence: VenueControllerLan): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ip of presence.ips) {
    const base = `http://${ip}:${presence.port}`;
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  return out;
}
