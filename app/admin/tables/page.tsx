import { IntegratedTableView } from "@/components/tables/IntegratedTableView";
import { buildIntegratedTableItems } from "@/lib/tables/integrated-table";
import {
  getPhysicalTables,
  getGames,
  getSeatsForGame,
  getGameClock,
  getGamePresets,
  getActiveMemberVisits,
} from "@/lib/data/queries";
import { COMBINE_PRIORITY } from "@/lib/constants";
import type { PhysicalTableCode } from "@/lib/constants";
import type { Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const [tables, games, presets, activeVisits] = await Promise.all([
    getPhysicalTables(),
    getGames(),
    getGamePresets(),
    getActiveMemberVisits(),
  ]);
  const defaultBuyIn = presets[0]?.buy_in ?? 500000;
  const gameMap = new Map(games.map((g) => [g.id, g]));

  const ordered = [...tables].sort(
    (a, b) =>
      COMBINE_PRIORITY.indexOf(a.code as PhysicalTableCode) -
      COMBINE_PRIORITY.indexOf(b.code as PhysicalTableCode),
  );

  const rows = await Promise.all(
    ordered.map(async (table) => {
      const game = table.current_game_id ? gameMap.get(table.current_game_id) ?? null : null;
      const [seats, clock] = await Promise.all([
        game ? getSeatsForGame(game.id, table.id) : Promise.resolve([] as Seat[]),
        game ? getGameClock(game.id) : Promise.resolve(null),
      ]);
      const occupied = seats.filter((s) => s.member_id).length;
      return { table, game, clock, seats, occupied };
    }),
  );

  const presetNameById = new Map(presets.map((p) => [p.id, p.name]));
  const items = buildIntegratedTableItems(rows, presetNameById);

  return (
    <IntegratedTableView
      tables={items}
      physicalTables={tables}
      presets={presets}
      activeVisits={activeVisits}
      defaultBuyIn={defaultBuyIn}
    />
  );
}
