import Link from "next/link";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { StatCard } from "@/components/admin/StatCard";
import { SessionBanner } from "@/components/admin/SessionBanner";
import { SectionHeader } from "@/components/admin/SectionHeader";
import {
  getDashboardStats,
  getRecentLogs,
  getGames,
  getOpenVenueSession,
} from "@/lib/data/queries";
import { LiveGamesTabs } from "@/components/games/LiveGamesTabs";
import { formatTimer } from "@/lib/utils/format";
import { demoClocks } from "@/lib/demo/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getGame } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

function isGameLive(status: string) {
  return status === "running" || status === "registration_closed";
}

export default async function DashboardPage() {
  const session = await getOpenVenueSession();
  const stats = await getDashboardStats();
  const logs = await getRecentLogs(8);
  const games = await getGames();
  const running = games.filter((g) => isGameLive(g.status));

  const runningWithClocks = await Promise.all(
    running.map(async (game) => {
      let clock = demoClocks[game.id];
      if (isSupabaseConfigured()) {
        const full = await getGame(game.id);
        const c = full?.game_clocks;
        clock = Array.isArray(c) ? c[0] : c ?? clock;
      }
      return { game, clock };
    }),
  );

  return (
    <>
      <AdminTopBar title="MNF HOLDEM" subtitle="통합 모니터링 데스크" />
      <div className="admin-main flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
        <SessionBanner session={session} />
        <LiveGamesTabs games={games} />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="진행 테이블" value={stats.activeTables} accent="primary" />
          <StatCard label="진행 게임" value={stats.activeGames} accent="tertiary" />
          <StatCard label="방문 손님" value={stats.visitors} accent="secondary" />
          <StatCard label="대기 손님" value={stats.waiting} />
          <StatCard label="게임중" value={stats.inGame} accent="primary" />
        </div>

        <section>
          <SectionHeader title="진행 중인 게임" />
          <div className="grid gap-4 md:grid-cols-2">
            {runningWithClocks.map(({ game, clock }) => {
              const live = isGameLive(game.status);
              return (
                <Link
                  key={game.id}
                  href={`/admin/games/${game.id}`}
                  className={`glass-panel glass-panel-hover rounded-2xl p-6 block ${
                    live ? "card-running" : ""
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-[0.15em] font-semibold">
                        {game.mode === "multi_table" ? "멀티테이블" : "싱글"}
                      </p>
                      {live ? (
                        <p className="status-running mt-2">Game · Running</p>
                      ) : (
                        <p className="text-xs text-on-surface-variant mt-2 uppercase tracking-wider">
                          {game.status}
                        </p>
                      )}
                      <p className="stat-display text-xl text-primary text-glow-primary mt-2">
                        #{game.daily_game_number ?? game.id.slice(-4)}
                      </p>
                    </div>
                    {clock && (
                      <span className="stat-display stat-display-lg text-primary text-glow-primary tabular-nums">
                        {formatTimer(clock.remaining_seconds)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-6 mt-5 pt-4 border-t border-white/10">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                        생존
                      </p>
                      <p className="stat-display text-2xl text-on-surface mt-0.5">
                        {game.survivor_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                        엔트리
                      </p>
                      <p className="stat-display text-2xl text-tertiary text-glow-tertiary mt-0.5">
                        {game.entry_count}
                      </p>
                    </div>
                    {game.registration_closed && (
                      <span className="self-end text-[10px] font-bold uppercase tracking-wider text-secondary border border-secondary/30 px-2 py-1 rounded-md bg-secondary/10">
                        레지 마감
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
            {running.length === 0 && (
              <p className="text-on-surface-variant col-span-2 py-8 text-center glass-panel rounded-2xl">
                진행 중인 게임이 없습니다.
              </p>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <SectionHeader title="시스템 실시간 로그" />
          <div className="space-y-3 max-h-52 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex gap-3 text-xs py-2 border-b border-white/5 last:border-0"
              >
                <span className="text-on-surface-variant/70 font-mono shrink-0 tabular-nums">
                  {new Date(log.created_at).toLocaleTimeString("ko-KR")}
                </span>
                <span className="flex-1 text-on-surface-variant">{log.message}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
