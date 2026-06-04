import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { TableDetailClient } from "@/components/tables/TableDetailClient";
import {
  getPhysicalTable,
  getPhysicalTables,
  getGames,
  getSeatsForGame,
  getActiveMemberVisits,
  getGamePresets,
  getGameClock,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tableId: string }> };

export default async function TableDetailPage({ params }: Props) {
  const { tableId } = await params;
  const table = await getPhysicalTable(tableId);
  if (!table) notFound();

  const [games, presets, allTables] = await Promise.all([
    getGames(),
    getGamePresets(),
    getPhysicalTables(),
  ]);

  const game = table.current_game_id
    ? games.find((g) => g.id === table.current_game_id) ?? null
    : null;

  const [seats, clock, activeVisits] = await Promise.all([
    game ? getSeatsForGame(game.id, table.id) : Promise.resolve([]),
    game ? getGameClock(game.id) : Promise.resolve(null),
    getActiveMemberVisits(),
  ]);
  const preset = game?.preset_id
    ? presets.find((p) => p.id === game.preset_id)
    : presets[0];
  const defaultBuyIn = preset?.buy_in ?? 500000;

  return (
    <>
      <AdminTopBar title={`${table.label} 관리`} subtitle="11인석 · 바이인 · 리바인 · 이동">
        <Link
          href="/admin/tables"
          className="text-sm text-on-surface-variant hover:text-primary flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          통합 뷰
        </Link>
      </AdminTopBar>
      <div className="admin-main flex-1 flex flex-col min-h-0 overflow-hidden p-2 md:p-3">
        <TableDetailClient
          table={table}
          game={game}
          seats={seats}
          activeVisits={activeVisits}
          preset={preset ?? null}
          clock={clock}
          defaultBuyIn={defaultBuyIn}
          allTables={allTables}
        />
      </div>
    </>
  );
}
