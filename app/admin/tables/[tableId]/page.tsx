import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { TableDetailClient } from "@/components/tables/TableDetailClient";
import {
  getPhysicalTable,
  getGames,
  getSeatsForGame,
  getActiveMemberVisits,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tableId: string }> };

export default async function TableDetailPage({ params }: Props) {
  const { tableId } = await params;
  const table = await getPhysicalTable(tableId);
  if (!table) notFound();

  const games = await getGames();
  const game = table.current_game_id
    ? games.find((g) => g.id === table.current_game_id) ?? null
    : null;

  const seats = game ? await getSeatsForGame(game.id, table.id) : [];
  const activeVisits = await getActiveMemberVisits();

  return (
    <>
      <AdminTopBar title={`${table.label} 관리`} subtitle="11인석 · 칩 합계/평균">
        <Link
          href="/admin/tables"
          className="text-sm text-on-surface-variant hover:text-primary flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          통합 뷰
        </Link>
      </AdminTopBar>
      <div className="admin-main flex-1 overflow-y-auto p-6 md:p-8">
        <TableDetailClient
          table={table}
          game={game}
          seats={seats}
          activeVisits={activeVisits}
        />
        {game && (
          <Link
            href={`/admin/games/${game.id}`}
            className="inline-block mt-6 text-primary font-semibold hover:underline"
          >
            게임 운영 화면으로 →
          </Link>
        )}
      </div>
    </>
  );
}
