import { GuestLinkPhone } from "@/components/guest/GuestLinkPhone";
import { GuestBuyInRequest } from "@/components/guest/GuestBuyInRequest";
import {
  getGuestMember,
  getGuestRecentPlacements,
  getRunningGamesForGuest,
} from "@/lib/data/guest-queries";
import { formatMp } from "@/lib/utils/mp";

export const dynamic = "force-dynamic";

export default async function GuestGamesPage() {
  const member = await getGuestMember();
  if (!member) return <GuestLinkPhone />;

  const [recent, running] = await Promise.all([
    getGuestRecentPlacements(member.id),
    getRunningGamesForGuest(member.venue_id ?? ""),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">게임</h1>

      <GuestBuyInRequest games={running} />

      <section>
        <h2 className="font-bold mb-2">최근 결과</h2>
        <ul className="space-y-2">
          {recent.map(
            (row: {
              id: string;
              finish_rank: number;
              final_amount: number;
              games?: { game_presets?: { name: string }; daily_game_number?: number };
            }) => (
              <li key={row.id} className="glass-panel rounded-lg px-4 py-3">
                <p className="font-semibold">
                  {row.games?.game_presets?.name ?? "게임"} · {row.finish_rank}등
                </p>
                <p className="text-sm text-primary">{formatMp(row.final_amount)}</p>
              </li>
            ),
          )}
          {recent.length === 0 && (
            <p className="text-sm text-on-surface-variant">기록이 없습니다.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
