import { getGames, getGame } from "@/lib/data/queries";
import { formatTimer } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

function isLive(status: string) {
  return status === "running" || status === "registration_closed";
}

export default async function TvPage() {
  const games = await getGames();
  const live = games.filter((g) => isLive(g.status));

  const displays = await Promise.all(
    live.map(async (g) => {
      const full = await getGame(g.id);
      const clock = full?.game_clocks;
      const c = Array.isArray(clock) ? clock[0] : clock;
      const tables = full?.game_table_assignments.map((a) => a.physical_tables?.code).join(" · ") ?? "";
      return { game: g, clock: c, tables };
    }),
  );

  return (
    <div className="min-h-dvh bg-[#0d0b11] text-white p-8 md:p-12">
      <header className="mb-10 flex justify-between items-center border-b border-white/10 pb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          MNF HOLDEM
        </h1>
        <span className="text-sm font-mono text-primary animate-pulse">LIVE</span>
      </header>

      <div className="grid gap-10 md:grid-cols-2">
        {displays.map(({ game, clock, tables }) => (
          <section
            key={game.id}
            className="rounded-3xl border border-primary/20 bg-white/5 p-8 backdrop-blur"
          >
            <p className="text-sm text-on-surface-variant mb-2">
              게임 #{game.daily_game_number} · {tables}
            </p>
            <p className="stat-display text-7xl md:text-8xl text-primary text-glow-primary tabular-nums">
              {clock ? formatTimer(clock.remaining_seconds) : "—"}
            </p>
            <p className="text-2xl text-tertiary mt-4">
              Level {clock?.level ?? 1} · {clock?.blind_small}/{clock?.blind_big}
              {clock?.ante ? ` · Ante ${clock.ante}` : ""}
            </p>
            <p className="text-xl text-secondary mt-6">
              생존 {game.survivor_count} / {game.entry_count} · RB {game.rebuy_count}
            </p>
          </section>
        ))}
      </div>

      {live.length === 0 && (
        <p className="text-center text-2xl text-on-surface-variant/60 mt-20">
          진행 중인 게임이 없습니다
        </p>
      )}
    </div>
  );
}
