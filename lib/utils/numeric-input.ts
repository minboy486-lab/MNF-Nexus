/** 정수 입력: type=number 대신 사용 (0 삭제·앞자리 0 방지) */
export function parseIntegerFromInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return 0;
  return parseInt(digits, 10);
}

export function formatIntegerDisplay(n: number, emptyWhenZero = true): string {
  if (emptyWhenZero && n === 0) return "";
  return String(n);
}

/** 소수(프라이즈 % 등) */
export function parseDecimalFromInput(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, "").replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return 0;
  const dot = cleaned.indexOf(".");
  const normalized =
    dot === -1
      ? cleaned
      : `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1).replace(/\./g, "")}`;
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function formatDecimalDisplay(n: number, emptyWhenZero = true): string {
  if (emptyWhenZero && n === 0) return "";
  return String(n);
}

/** @deprecated BlindStructureEditor 호환 */
export function parseNumInput(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const digits = trimmed.replace(/\D/g, "");
  if (digits === "") return fallback;
  return parseInt(digits, 10);
}

export function numDisplay(n: number): string {
  return formatIntegerDisplay(n);
}
