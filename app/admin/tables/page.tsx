import { IntegratedTableView } from "@/components/tables/IntegratedTableView";
import { buildIntegratedTableItems } from "@/lib/tables/integrated-table";
import { getPhysicalTables, getGames, getSeatsForGame } from "@/lib/data/queries";
import { formatChips } from "@/lib/utils/format";
import { COMBINE_PRIORITY } from "@/lib/constants";
import type { PhysicalTableCode } from "@/lib/constants";
import type { Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const tables = await getPhysicalTables();
  const games = await getGames();
  const gameMap = new Map(games.map((g) => [g.id, g]));

  const ordered = [...tables].sort(
    (a, b) =>
      COMBINE_PRIORITY.indexOf(a.code as PhysicalTableCode) -
      COMBINE_PRIORITY.indexOf(b.code as PhysicalTableCode),
  );

  const rows = await Promise.all(
    ordered.map(async (table) => {
      const game = table.current_game_id ? gameMap.get(table.current_game_id) : null;
      const seats: Seat[] = game ? await getSeatsForGame(game.id, table.id) : [];
      const totalChips = seats.reduce((s, x) => s + Number(x.chips), 0);
      const occupied = seats.filter((s) => s.member_id).length;
      return { table, game, seats, totalChips, occupied };
    }),
  );

  const items = buildIntegratedTableItems(rows, formatChips);

  return <IntegratedTableView tables={items} />;
}
