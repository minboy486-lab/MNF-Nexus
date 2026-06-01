import Link from "next/link";
import { getGames } from "@/lib/data/queries";
import { formatTimer } from "@/lib/utils/format";
import { demoClocks } from "@/lib/demo/data";

export const dynamic = "force-dynamic";

export default async function StaffGamesPage() {
  const games = await getGames();
  const active = games.filter(
    (g) => g.status === "running" || g.status === "registration_closed",
  );

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">진행 게임</h1>
      <p className="text-sm text-on-surface-variant">
        타이머·리바인·좌석 — 관리자와 실시간 동기화
      </p>
      {active.map((game) => {
        const clock = demoClocks[game.id];
        return (
          <Link
            key={game.id}
            href={`/admin/games/${game.id}`}
            className="block glass-panel rounded-xl p-5 border border-primary/20"
          >
            <div className="flex justify-between">
              <span className="font-bold">게임 {game.id.slice(-6)}</span>
              {clock && (
                <span className="font-mono text-primary">{formatTimer(clock.remaining_seconds)}</span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant mt-2">
              {game.survivor_count}/{game.entry_count} 생존
            </p>
          </Link>
        );
      })}
      {active.length === 0 && (
        <p className="text-on-surface-variant">진행 중인 게임이 없습니다.</p>
      )}
    </div>
  );
}
