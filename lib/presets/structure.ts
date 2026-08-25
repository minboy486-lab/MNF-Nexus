import type { BlindLevel, BlindStructureRow } from "@/lib/types";

export function newStructureRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** DB/legacy rows without `kind` are treated as play levels. */
export function isPlayLevel(
  row: BlindStructureRow | BlindLevel,
): row is Extract<BlindStructureRow, { kind: "level" }> | BlindLevel {
  return (
    row.kind === "level" ||
    (row.kind !== "break" &&
      row.kind !== "reg-close" &&
      "level" in row &&
      typeof row.level === "number")
  );
}

export function isPauseRow(
  row: BlindStructureRow,
): row is Extract<BlindStructureRow, { kind: "break" | "reg-close" }> {
  return row.kind === "break" || row.kind === "reg-close";
}

export function normalizeStructure(raw: unknown): BlindStructureRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id ? row.id : newStructureRowId();
    if (row.kind === "break") {
      return { kind: "break" as const, id, minutes: Number(row.minutes) || 0 };
    }
    if (row.kind === "reg-close") {
      return { kind: "reg-close" as const, id, minutes: Number(row.minutes) || 0 };
    }
    return {
      kind: "level" as const,
      id,
      level: Number(row.level) || 1,
      small: Number(row.small) || 0,
      big: Number(row.big) || 0,
      ante: Number(row.ante) || 0,
      minutes: Number(row.minutes) || 0,
    };
  });
}

export function countPlayLevels(rows: BlindStructureRow[]): number {
  return rows.filter(isPlayLevel).length;
}

export function renumberLevels(rows: BlindStructureRow[]): BlindStructureRow[] {
  let n = 0;
  return rows.map((row) => {
    if (isPauseRow(row)) return row;
    n += 1;
    return { ...row, kind: "level" as const, level: n };
  });
}

export function createDefaultStructure(): BlindStructureRow[] {
  return [
    { kind: "level", id: newStructureRowId(), level: 1, small: 100, big: 200, ante: 0, minutes: 15 },
    { kind: "level", id: newStructureRowId(), level: 2, small: 200, big: 400, ante: 0, minutes: 15 },
    { kind: "level", id: newStructureRowId(), level: 3, small: 300, big: 600, ante: 0, minutes: 15 },
    { kind: "level", id: newStructureRowId(), level: 4, small: 400, big: 800, ante: 0, minutes: 15 },
    { kind: "break", id: newStructureRowId(), minutes: 10 },
    { kind: "level", id: newStructureRowId(), level: 5, small: 500, big: 1000, ante: 0, minutes: 15 },
    { kind: "level", id: newStructureRowId(), level: 6, small: 600, big: 1200, ante: 600, minutes: 15 },
    { kind: "level", id: newStructureRowId(), level: 7, small: 800, big: 1600, ante: 800, minutes: 15 },
    { kind: "level", id: newStructureRowId(), level: 8, small: 1000, big: 2000, ante: 1000, minutes: 15 },
  ];
}

/** Serialize for DB (keeps `kind` on levels for clarity). */
export function serializeStructure(rows: BlindStructureRow[]): BlindStructureRow[] {
  return renumberLevels(rows);
}

export function getPlayLevels(
  rows: BlindStructureRow[],
): Extract<BlindStructureRow, { kind: "level" }>[] {
  return rows.filter(isPlayLevel) as Extract<BlindStructureRow, { kind: "level" }>[];
}

export function validateStructureForSave(rows: BlindStructureRow[]): string | null {
  if (countPlayLevels(rows) === 0) return "블라인드 레벨을 1개 이상 추가하세요.";
  for (const row of rows) {
    if (row.kind === "level") {
      if (!row.small || !row.big || !row.minutes) {
        return "블라인드 SB, BB, 시간은 비울 수 없습니다.";
      }
    } else if (!row.minutes) {
      return row.kind === "reg-close"
        ? "레지 마감 시간을 입력하세요."
        : "쉬는 시간 분을 입력하세요.";
    }
  }
  return null;
}
