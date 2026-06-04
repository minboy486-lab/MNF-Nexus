import Link from "next/link";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { LiveGamesTabs } from "@/components/games/LiveGamesTabs";
import { getGames, getGame } from "@/lib/data/queries";
import { formatTimer } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

function isLive(status: string) {
  return status === "running" || status === "registration_closed";
}

export default async function OperationsPage() {
  const games = await getGames();
  const live = games.filter((g) => isLive(g.status));

  const cards = await Promise.all(
    live.map(async (g) => {
      const full = await getGame(g.id);
      const clock = full?.game_clocks;
      const c = Array.isArray(clock) ? clock[0] : clock;
      const tables = full?.game_table_assignments.map((a) => a.physical_tables?.code).filter(Boolean) ?? [];
      return { game: g, clock: c, tables };
    }),
  );

  return (
    <>
      <AdminTopBar title="운영 · 멀티 타이머" subtitle="진행 중 게임 동시 모니터링" />
      <div className="admin-main flex-1 overflow-y-auto p-6 md:p-8">
        <LiveGamesTabs games={games} />

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(({ game, clock, tables }) => (
            <Link
              key={game.id}
              href={`/admin/games/${game.id}`}
              className="glass-panel rounded-2xl p-6 border border-primary/20 hover:border-primary/50 transition-colors card-running"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs text-on-surface-variant">게임 #{game.daily_game_number}</p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {clock ? formatTimer(clock.remaining_seconds) : "—"}
                  </p>
                </div>
                <span className="text-xs font-mono text-primary">LIVE</span>
              </div>
              <p className="text-sm text-tertiary">
                Lv.{clock?.level ?? 1} {clock?.blind_small}/{clock?.blind_big}
              </p>
              <p className="text-sm text-on-surface-variant mt-2">
                테이블 {tables.join(" · ")} · 생존 {game.survivor_count}/{game.entry_count}
              </p>
            </Link>
          ))}
        </div>

        {live.length === 0 && (
          <p className="text-on-surface-variant">진행 중인 게임이 없습니다.</p>
        )}
      </div>
    </>
  );
}
