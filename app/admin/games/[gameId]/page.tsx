import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { GameLiveClient } from "@/components/games/GameLiveClient";
import { getGame, getPhysicalTables, getSeatsForGame } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ gameId: string }> };

export default async function GameLivePage({ params }: Props) {
  const { gameId } = await params;
  const game = await getGame(gameId);
  if (!game) notFound();

  const tables = await getPhysicalTables();
  const allSeats = await getSeatsForGame(gameId);
  const totalChips = allSeats.reduce((s, x) => s + Number(x.chips), 0);
  const occupied = allSeats.filter((s) => s.member_id).length;
  const avgChips = occupied ? Math.round(totalChips / occupied) : 0;

  return (
    <>
      <AdminTopBar
        title="게임 운영"
        subtitle={game.game_presets?.name ?? "라이브"}
      >
        <Link href="/admin/dashboard" className="text-sm text-on-surface-variant hover:text-primary">
          대시보드
        </Link>
      </AdminTopBar>
      <div className="flex-1 overflow-y-auto p-6">
        <GameLiveClient game={game} allTables={tables} totalChips={totalChips} avgChips={avgChips} />
      </div>
    </>
  );
}
