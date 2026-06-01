import Link from "next/link";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { MetricBlock } from "@/components/admin/MetricBlock";
import { PokerTableOval } from "@/components/poker/PokerTableOval";
import { getPhysicalTables, getGames, getSeatsForGame } from "@/lib/data/queries";
import { formatChips } from "@/lib/utils/format";
import { COMBINE_PRIORITY } from "@/lib/constants";
import type { PhysicalTableCode } from "@/lib/constants";
import type { Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

function isRunning(status: string | undefined) {
  return status === "running" || status === "registration_closed";
}

export default async function TablesPage() {
  const tables = await getPhysicalTables();
  const games = await getGames();
  const gameMap = new Map(games.map((g) => [g.id, g]));

  const ordered = [...tables].sort(
    (a, b) =>
      COMBINE_PRIORITY.indexOf(a.code as PhysicalTableCode) -
      COMBINE_PRIORITY.indexOf(b.code as PhysicalTableCode),
  );

  const tableData = await Promise.all(
    ordered.map(async (table) => {
      const game = table.current_game_id ? gameMap.get(table.current_game_id) : null;
      const seats: Seat[] = game ? await getSeatsForGame(game.id, table.id) : [];
      const totalChips = seats.reduce((s, x) => s + Number(x.chips), 0);
      const occupied = seats.filter((s) => s.member_id).length;
      return { table, game, seats, totalChips, occupied };
    }),
  );

  return (
    <>
      <AdminTopBar title="통합 테이블 뷰" subtitle="물리 테이블 B · C · D 중심" />
      <div className="admin-main flex-1 overflow-y-auto p-6 md:p-8">
        <p className="text-on-surface-variant/80 text-sm mb-6 font-medium">
          컴바인 우선순위{" "}
          <span className="text-primary font-bold">D → B → C</span>
          <span className="mx-2 text-white/20">|</span>
          분할 권장{" "}
          <span className="text-secondary font-bold">D → B → C</span>
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {tableData.map(({ table, game, seats, totalChips, occupied }) => {
            const live = game && isRunning(game.status);
            return (
              <Link
                key={table.id}
                href={`/admin/tables/${table.id}`}
                className={`glass-panel glass-panel-hover rounded-3xl p-6 md:p-7 block ${
                  live ? "card-running" : ""
                }`}
              >
                <div className="flex justify-between items-start gap-4 mb-5">
                  <div className="flex items-center gap-4">
                    <span className="table-code-badge">{table.code}</span>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">{table.label}</h3>
                      {live ? (
                        <p className="status-running mt-1.5">Game · Running</p>
                      ) : (
                        <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-[0.2em] mt-1.5 font-semibold">
                          {game ? game.status : "Waiting"}
                        </p>
                      )}
                    </div>
                  </div>
                  {game && (
                    <MetricBlock
                      label="칩 합계"
                      value={formatChips(totalChips)}
                      sub={`${occupied}/11`}
                      accent="primary"
                    />
                  )}
                </div>
                {game ? (
                  <PokerTableOval tableCode={table.code} seats={seats} compact />
                ) : (
                  <div className="aspect-[2/1] poker-table-surface rounded-[120px] flex items-center justify-center opacity-50">
                    <p className="text-on-surface-variant text-sm font-medium">게임 없음</p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
