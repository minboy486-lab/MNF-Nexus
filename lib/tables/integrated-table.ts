import type { Seat } from "@/lib/types";

const GRID_CLASS: Record<string, string> = {
  D: "col-start-1 col-span-5 row-start-4 row-span-3",
  B: "col-start-4 col-span-5 row-start-1 row-span-3",
  C: "col-start-8 col-span-5 row-start-4 row-span-3",
  A: "hidden",
};

export type IntegratedTableItem = {
  tableId: string;
  code: string;
  name: string;
  statusLabel: string;
  isRunning: boolean;
  totalChips: string;
  occupied: number;
  seats: Seat[];
  gridClass: string;
};

function isRunning(status: string) {
  return status === "running" || status === "registration_closed";
}

export function buildIntegratedTableItems(
  rows: {
    table: { id: string; code: string; label: string };
    game: { status: string } | null;
    seats: Seat[];
    totalChips: number;
    occupied: number;
  }[],
  formatChips: (n: number) => string,
): IntegratedTableItem[] {
  return rows
    .filter((r) => r.table.code !== "A")
    .map((r) => {
      const live = r.game && isRunning(r.game.status);
      return {
        tableId: r.table.id,
        code: r.table.code,
        name: r.table.label,
        statusLabel: live ? "GAME - RUNNING" : r.game ? r.game.status.toUpperCase() : "WAITING",
        isRunning: Boolean(live),
        totalChips: formatChips(r.totalChips),
        occupied: r.occupied,
        seats: r.seats,
        gridClass: GRID_CLASS[r.table.code] ?? "col-span-4",
      };
    });
}
