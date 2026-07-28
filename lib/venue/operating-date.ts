const VENUE_TIMEZONE = "Asia/Seoul";
/** KST 17:00부터 당일 영업일로 전환 */
export const VENUE_OPERATING_ROLLOVER_HOUR = 17;

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((p) => p.type === type)?.value ?? "";
}

export function getKSTNowParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VENUE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  let hour = Number(getPart(parts, "hour"));
  if (hour === 24) hour = 0;

  return {
    year: Number(getPart(parts, "year")),
    month: Number(getPart(parts, "month")),
    day: Number(getPart(parts, "day")),
    hour,
    minute: Number(getPart(parts, "minute")),
    second: Number(getPart(parts, "second")),
  };
}

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 매장 영업일: KST 17:00 이전 → 전날, 17:00 이후 → 당일 */
export function getVenueOperatingDate(now: Date = new Date()): string {
  const { year, month, day, hour } = getKSTNowParts(now);
  if (hour >= VENUE_OPERATING_ROLLOVER_HOUR) {
    return toISODate(year, month, day);
  }

  const anchor = new Date(`${toISODate(year, month, day)}T12:00:00+09:00`);
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  const prev = getKSTNowParts(anchor);
  return toISODate(prev.year, prev.month, prev.day);
}

export function isVenueOperatingToday(isoDate: string, now: Date = new Date()): boolean {
  return isoDate === getVenueOperatingDate(now);
}

/** 다음 KST 17:00까지 남은 ms (페이지 자동 갱신용) */
export function getMsUntilNextVenueRollover(now: Date = new Date()): number {
  const { year, month, day, hour } = getKSTNowParts(now);
  const hourStr = String(VENUE_OPERATING_ROLLOVER_HOUR).padStart(2, "0");

  let target: Date;
  if (hour < VENUE_OPERATING_ROLLOVER_HOUR) {
    target = new Date(`${toISODate(year, month, day)}T${hourStr}:00:00+09:00`);
  } else {
    const anchor = new Date(`${toISODate(year, month, day)}T12:00:00+09:00`);
    anchor.setUTCDate(anchor.getUTCDate() + 1);
    const next = getKSTNowParts(anchor);
    target = new Date(`${toISODate(next.year, next.month, next.day)}T${hourStr}:00:00+09:00`);
  }

  return Math.max(1000, target.getTime() - now.getTime());
}
