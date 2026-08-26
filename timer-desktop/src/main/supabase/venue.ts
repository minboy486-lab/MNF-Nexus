import { YEOKSAM_VENUE_ID, isKnownVenueId } from "@mnf/venue";
import { controlPinMatches, isControlPin } from "@mnf/venue/control-pin";
import { getSupabase } from "./client";
import { loadConfig } from "../config/configStore";
import { normalizeYeoksamRole, type YeoksamRole } from "../../shared/types";

export function getConfiguredVenueId(): string {
  const id = loadConfig()?.venueId;
  return isKnownVenueId(id) ? id : YEOKSAM_VENUE_ID;
}

export function getConfiguredYeoksamRole(): YeoksamRole {
  return normalizeYeoksamRole(loadConfig()?.yeoksamRole);
}

export async function verifyVenueControlPin(
  venueId: string,
  pin: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isKnownVenueId(venueId)) return { ok: false, error: "알 수 없는 지점입니다." };
  if (!isControlPin(pin)) return { ok: false, error: "비밀번호는 숫자 4자리입니다." };

  const sb = getSupabase();
  if (!sb) {
    if (controlPinMatches(pin, null)) return { ok: true };
    return { ok: false, error: "비밀번호가 올바르지 않습니다." };
  }

  const { data, error } = await sb
    .from("venues")
    .select("settings")
    .eq("id", venueId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const settings = data?.settings as { control_pin?: unknown } | null;
  if (!controlPinMatches(pin, settings?.control_pin)) {
    return { ok: false, error: "비밀번호가 올바르지 않습니다." };
  }
  return { ok: true };
}
