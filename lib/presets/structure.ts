import type { BlindLevel, BlindStructureRow } from "@/lib/types";

/** DB/legacy rows without `kind` are treated as play levels. */
export function isPlayLevel(
  row: BlindStructureRow | BlindLevel,
): row is Extract<BlindStructureRow, { kind: "level" }> | BlindLevel {
  return row.kind === "level" || (row.kind !== "break" && "level" in row && typeof row.level === "number");
}

export function isBreak(row: BlindStructureRow): row is Extract<BlindStructureRow, { kind: "break" }> {
  return row.kind === "break";
}

export function normalizeStructure(raw: unknown): BlindStructureRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    if (row.kind === "break") {
      return { kind: "break" as const, minutes: Number(row.minutes) || 10 };
    }
    return {
      kind: "level" as const,
      level: Number(row.level) || 1,
      small: Number(row.small) || 0,
      big: Number(row.big) || 0,
      ante: Number(row.ante) || 0,
      minutes: Number(row.minutes) || 15,
    };
  });
}

export function countPlayLevels(rows: BlindStructureRow[]): number {
  return rows.filter(isPlayLevel).length;
}

export function renumberLevels(rows: BlindStructureRow[]): BlindStructureRow[] {
  let n = 0;
  return rows.map((row) => {
    if (isBreak(row)) return row;
    n += 1;
    return { ...row, kind: "level" as const, level: n };
  });
}

export function createDefaultStructure(): BlindStructureRow[] {
  return [
    { kind: "level", level: 1, small: 100, big: 200, ante: 0, minutes: 15 },
    { kind: "level", level: 2, small: 200, big: 400, ante: 0, minutes: 15 },
    { kind: "level", level: 3, small: 300, big: 600, ante: 0, minutes: 15 },
    { kind: "level", level: 4, small: 400, big: 800, ante: 0, minutes: 15 },
    { kind: "break", minutes: 10 },
    { kind: "level", level: 5, small: 500, big: 1000, ante: 0, minutes: 15 },
    { kind: "level", level: 6, small: 600, big: 1200, ante: 600, minutes: 15 },
    { kind: "level", level: 7, small: 800, big: 1600, ante: 800, minutes: 15 },
    { kind: "level", level: 8, small: 1000, big: 2000, ante: 1000, minutes: 15 },
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
