import { notFound } from "next/navigation";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { GameSettlementClient } from "@/components/games/GameSettlementClient";
import { getSettlementData } from "@/lib/data/prize-queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ gameId: string }> };

export default async function GameSettlementPage({ params }: Props) {
  const { gameId } = await params;
  const { game, placements, icm, survivors } = await getSettlementData(gameId);
  if (!game) notFound();

  return (
    <>
      <AdminTopBar title="프라이즈 · ICM" subtitle={`게임 #${game.daily_game_number ?? "—"}`} />
      <div className="flex-1 overflow-y-auto p-6">
        <GameSettlementClient
          game={game}
          placements={placements}
          icm={icm}
          survivors={survivors}
        />
      </div>
    </>
  );
}
