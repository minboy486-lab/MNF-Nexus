import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { app } from "electron";
import type { BlindStructureOption } from "@mnf/timer/types";
import { getConfiguredVenueId } from "../supabase/venue";

function localBlindsPath(venueId: string): string {
  const dir = app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  const safe = venueId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return resolve(dir, `local-blinds-${safe}.json`);
}

export function loadLocalBlinds(venueId?: string): BlindStructureOption[] {
  const id = venueId ?? getConfiguredVenueId();
  try {
    const p = localBlindsPath(id);
    if (!existsSync(p)) return [];
    const raw = JSON.parse(readFileSync(p, "utf-8")) as BlindStructureOption[];
    if (!Array.isArray(raw)) return [];
    return raw.map((o) => ({
      ...o,
      isChampionship: o.isChampionship === true,
    }));
  } catch {
    return [];
  }
}

export function saveLocalBlinds(data: BlindStructureOption[], venueId?: string): void {
  const id = venueId ?? getConfiguredVenueId();
  writeFileSync(localBlindsPath(id), JSON.stringify(data, null, 2), "utf-8");
}

export function championshipStructureIds(venueId?: string): Set<string> {
  const ids = new Set<string>();
  for (const o of loadLocalBlinds(venueId)) {
    if (o.isChampionship && o.id) ids.add(o.id);
  }
  return ids;
}
