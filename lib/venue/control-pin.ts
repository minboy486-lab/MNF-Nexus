import { createHash, timingSafeEqual } from "crypto";

const PIN_PREFIX = "mnf-control-pin:";
const DEFAULT_PIN = "1234";

export function isControlPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

export function hashControlPin(pin: string): string {
  return createHash("sha256").update(`${PIN_PREFIX}${pin}`).digest("hex");
}

export function controlPinMatches(pin: string, stored: unknown): boolean {
  if (!isControlPin(pin)) return false;
  if (typeof stored !== "string" || stored.length === 0) {
    return pin === DEFAULT_PIN;
  }
  const a = Buffer.from(hashControlPin(pin), "utf8");
  const b = Buffer.from(stored, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
