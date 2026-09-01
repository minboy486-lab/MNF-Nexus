import { hostname } from "node:os";
import { REMOTE_PORT } from "../../shared/remote";
import { getConfiguredVenueId } from "./venue";
import { getSupabase } from "./client";

const SETTINGS_KEY = "controller_lan";

export async function publishControllerLanPresence(opts: {
  ips: string[];
  pin: string;
  port?: number;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const ips = opts.ips.filter((ip) => typeof ip === "string" && ip.trim().length > 0);
  if (!ips.length || !/^\d{4}$/.test(opts.pin)) return;

  const venueId = getConfiguredVenueId();
  const { data: row, error: readError } = await sb
    .from("venues")
    .select("settings")
    .eq("id", venueId)
    .maybeSingle();
  if (readError) {
    console.warn("[controller] presence read 실패", readError.message);
    return;
  }

  const settings =
    row?.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
      ? { ...(row.settings as Record<string, unknown>) }
      : {};

  settings[SETTINGS_KEY] = {
    ips,
    port: opts.port ?? REMOTE_PORT,
    pin: opts.pin,
    hostname: hostname() || "pc",
    updatedAt: new Date().toISOString(),
  };

  const { error } = await sb.from("venues").update({ settings }).eq("id", venueId);
  if (error) console.warn("[controller] presence write 실패", error.message);
}
