import Link from "next/link";
import { GuestLinkPhone } from "@/components/guest/GuestLinkPhone";
import {
  getGuestMember,
  getGuestWinPointsTotal,
  getGuestPendingRequests,
} from "@/lib/data/guest-queries";
import { getPhysicalTables, getGames, getOpenVenueSession } from "@/lib/data/queries";
import { formatChips } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function GuestHomePage() {
  const member = await getGuestMember();

  if (!member) {
    return <GuestLinkPhone />;
  }

  const [winPoints, pending, session, tables, games] = await Promise.all([
    getGuestWinPointsTotal(member.id),
    getGuestPendingRequests(member.id),
    getOpenVenueSession(),
    getPhysicalTables(),
    getGames(),
  ]);

  const activeTables = tables.filter((t) => t.current_game_id);
  const running = games.filter(
    (g) => g.status === "running" || g.status === "registration_closed",
  );

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-5 border border-primary/20">
        <p className="text-sm text-on-surface-variant">안녕하세요</p>
        <p className="text-2xl font-bold mt-1">{member.nickname}</p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-xs text-on-surface-variant">포인트</p>
            <p className="text-xl font-bold text-primary">{formatChips(member.point_balance)}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">승점</p>
            <p className="text-xl font-bold">{winPoints.toLocaleString()}p</p>
          </div>
        </div>
        {member.credit_balance < 0 && (
          <p className="text-error text-sm mt-3 font-semibold">
            외상: {formatChips(member.credit_balance)}
          </p>
        )}
      </section>

      {session ? (
        <p className="text-sm text-emerald-400">● 영업 중</p>
      ) : (
        <p className="text-sm text-on-surface-variant">영업 준비 중</p>
      )}

      {pending.length > 0 && (
        <section className="glass-panel rounded-xl p-4 border border-primary/30">
          <p className="text-sm font-bold text-primary">대기 중 요청 {pending.length}건</p>
        </section>
      )}

      <section>
        <h2 className="font-bold mb-2">진행 테이블</h2>
        {activeTables.length === 0 ? (
          <p className="text-sm text-on-surface-variant">진행 중인 테이블이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {activeTables.map((t) => (
              <li key={t.id} className="glass-panel rounded-lg px-4 py-3 flex justify-between">
                <span className="font-bold">테이블 {t.code}</span>
                <span className="text-xs text-on-surface-variant">게임 진행 중</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-bold mb-2">진행 게임</h2>
        <ul className="space-y-2">
          {running.map((g) => (
            <li key={g.id} className="glass-panel rounded-lg px-4 py-3 text-sm">
              #{(g as { daily_game_number?: number }).daily_game_number ?? "—"} ·{" "}
              {(g as { game_presets?: { name: string } }).game_presets?.name ?? "게임"}
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/guest/bingo"
        className="block glass-panel rounded-xl p-4 text-center text-on-surface-variant text-sm"
      >
        빙고 현황 (준비 중)
      </Link>
    </div>
  );
}
