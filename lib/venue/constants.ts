/** 역삼점 (기존 seed). */
export const YEOKSAM_VENUE_ID = "00000000-0000-4000-8000-000000000001";
/** 미사점. */
export const MISA_VENUE_ID = "00000000-0000-4000-8000-000000000002";

/** @deprecated 역삼 고정값. 운영 조회는 getActiveVenueId()를 쓴다. */
export const DEFAULT_VENUE_ID = YEOKSAM_VENUE_ID;

export const VENUE_COOKIE = "mnf_venue";

export type VenueCode = "yeoksam" | "misa";

export type KnownVenue = {
  id: string;
  code: VenueCode;
  name: string;
  shortName: string;
};

export const KNOWN_VENUES: readonly KnownVenue[] = [
  { id: YEOKSAM_VENUE_ID, code: "yeoksam", name: "역삼점", shortName: "역삼" },
  { id: MISA_VENUE_ID, code: "misa", name: "미사점", shortName: "미사" },
] as const;

export const KNOWN_VENUE_IDS: readonly string[] = KNOWN_VENUES.map((v) => v.id);

export function isKnownVenueId(id: string | null | undefined): id is string {
  return typeof id === "string" && (KNOWN_VENUE_IDS as readonly string[]).includes(id);
}

export function venueById(id: string | null | undefined): KnownVenue | null {
  if (!id) return null;
  return KNOWN_VENUES.find((v) => v.id === id) ?? null;
}

export function venueName(id: string | null | undefined): string {
  return venueById(id)?.name ?? "지점";
}

export function defaultVenuesForRole(role: string | null | undefined): string[] {
  if (role === "manager" || role === "staff" || role === "screen" || role === "counter") {
    return [YEOKSAM_VENUE_ID];
  }
  return [];
}
