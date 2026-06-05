import type { Game, GameClock, Seat } from "@/lib/types";

/** D·C 하단 좌우, B 상단 가운데 (동일 크기) */
const GRID_CLASS: Record<string, string> = {
  D: "integrated-slot-d",
  B: "integrated-slot-b",
  C: "integrated-slot-c",
  A: "integrated-slot-a",
};

export type IntegratedTableItem = {
  tableId: string;
  code: string;
  name: string;
  statusLabel: string;
  isRunning: boolean;
  hasGame: boolean;
  gameId: string | null;
  occupied: number;
  /** 최초 바인 수 */
  entryCount: number;
  /** 리바인 수 */
  rebuyCount: number;
  /** 총 바인수 = 최초바인 + 리바인 */
  totalBuyInCount: number;
  survivorCount: number;
  blindLevel: number | null;
  blindSmall: number | null;
  blindBig: number | null;
  blindAnte: number | null;
  /** 연결 게임의 블라인드(프리셋) 이름 */
  presetName: string | null;
  seats: Seat[];
  gridClass: string;
};

function isRunning(status: string) {
  return status === "running" || status === "registration_closed";
}

function countSeatedInGame(
  rows: { game: Game | null; seats: Seat[] }[],
  gameId: string,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.game?.id !== gameId) continue;
    total += row.seats.filter((s) => s.member_id).length;
  }
  return total;
}

export function buildIntegratedTableItems(
  rows: {
    table: { id: string; code: string; label: string };
    game: Game | null;
    clock: GameClock | null;
    seats: Seat[];
    occupied: number;
  }[],
  presetNameById: Map<string, string> = new Map(),
): IntegratedTableItem[] {
  return rows.map((r) => {
      const live = r.game && isRunning(r.game.status);
      const hasGame = Boolean(r.game);
      const presetName =
        r.game?.preset_id != null
          ? (presetNameById.get(r.game.preset_id) ?? null)
          : null;
      return {
        tableId: r.table.id,
        code: r.table.code,
        name: r.table.label,
        statusLabel: live ? "GAME - RUNNING" : hasGame ? r.game!.status.toUpperCase() : "WAITING",
        isRunning: Boolean(live),
        hasGame,
        gameId: r.game?.id ?? null,
        occupied: r.occupied,
        entryCount: r.game?.entry_count ?? 0,
        rebuyCount: r.game?.rebuy_count ?? 0,
        totalBuyInCount:
          (r.game?.entry_count ?? 0) + (r.game?.rebuy_count ?? 0),
        survivorCount: r.game?.id
          ? countSeatedInGame(rows, r.game.id)
          : 0,
        blindLevel: r.clock?.level ?? (hasGame ? 1 : null),
        blindSmall: r.clock?.blind_small ?? null,
        blindBig: r.clock?.blind_big ?? null,
        blindAnte: r.clock?.ante ?? null,
        presetName,
        seats: r.seats,
        gridClass: GRID_CLASS[r.table.code] ?? "col-span-4",
      };
    });
}

export function formatIntegratedBlinds(item: IntegratedTableItem): string {
  if (item.blindSmall == null || item.blindBig == null) return "—";
  const sb = item.blindSmall.toLocaleString("ko-KR");
  const bb = item.blindBig.toLocaleString("ko-KR");
  if (item.blindAnte && item.blindAnte > 0) {
    return `${sb} / ${bb} (${item.blindAnte.toLocaleString("ko-KR")})`;
  }
  return `${sb} / ${bb}`;
}
