"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PokerTableOval } from "@/components/poker/PokerTableOval";
import { SeatAssignPopover } from "@/components/tables/SeatAssignPopover";
import { SeatOccupiedMenu } from "@/components/tables/SeatOccupiedMenu";
import { TableGameHudBar } from "@/components/tables/TableGameHudBar";
import {
  assignSeatWithBuyIn,
  sitOutPlayer,
  manualRebuy,
  moveSeat,
  quickStartGameOnTable,
} from "@/lib/actions/games";
import type {
  GameClock,
  MemberVisitWithMember,
  PhysicalTable,
  Seat,
  Game,
  GamePreset,
} from "@/lib/types";
import type { PaymentMethod } from "@/lib/actions/ledger";

type Props = {
  table: PhysicalTable;
  game: Game | null;
  seats: Seat[];
  activeVisits: MemberVisitWithMember[];
  preset: GamePreset | null;
  clock: GameClock | null;
  defaultBuyIn: number;
  allTables: PhysicalTable[];
};

type SeatMenu =
  | { kind: "assign"; seatNumber: number }
  | { kind: "occupied"; seat: Seat }
  | null;

export function TableDetailClient({
  table,
  game,
  seats,
  activeVisits,
  preset,
  clock,
  defaultBuyIn,
  allTables,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menu, setMenu] = useState<SeatMenu>(null);
  const [buyInAmount] = useState(defaultBuyIn);
  const paymentMethod: PaymentMethod = "cash";
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const raw = searchParams.get("seat");
    if (!raw) return;
    const n = Number(raw);
    if (n >= 1 && n <= 11) {
      const seat = seats.find((s) => s.seat_number === n);
      if (seat?.member_id) setMenu({ kind: "occupied", seat });
      else setMenu({ kind: "assign", seatNumber: n });
    }
  }, [searchParams, seats]);

  const unseatedVisits = activeVisits.filter(
    (v) => !seats.some((s) => s.member_id === v.member_id),
  );

  const otherTables = allTables.filter(
    (t) => t.id !== table.id && game?.id && t.current_game_id === game.id,
  );

  function closeMenu() {
    setMenu(null);
  }

  function handleSeatClick(seatNumber: number) {
    if (!game) return;
    const seat = seats.find((s) => s.seat_number === seatNumber);
    if (seat?.member_id) {
      setMenu({ kind: "occupied", seat });
      return;
    }
    setMenu({ kind: "assign", seatNumber });
  }

  async function handleQuickStart() {
    setPending(true);
    const presetId = preset?.id;
    const result = await quickStartGameOnTable(table.id, presetId);
    setPending(false);
    if (result && "error" in result && result.error && !("gameId" in result && result.gameId)) {
      alert(result.error);
      return;
    }
    if (result && "gameId" in result && result.gameId) {
      router.push(`/admin/games/${result.gameId}`);
    } else {
      router.refresh();
    }
  }

  async function handleAssign(visit: MemberVisitWithMember) {
    if (!game || menu?.kind !== "assign") return;
    setPending(true);
    const result = await assignSeatWithBuyIn(
      game.id,
      table.id,
      menu.seatNumber,
      visit.member_id,
      buyInAmount,
      paymentMethod,
      visit.id,
    );
    setPending(false);
    if (result && "error" in result && result.error) {
      alert(result.error);
      return;
    }
    closeMenu();
    router.refresh();
  }

  async function handleSitOut(seat: Seat) {
    if (!game || !seat.member_id) return;
    closeMenu();
    await sitOutPlayer(seat.member_id, game.id);
    router.refresh();
  }

  async function handleManualRebuy(seat: Seat) {
    if (!game || !seat.member_id) return;
    closeMenu();
    setPending(true);
    await manualRebuy(game.id, seat.id, seat.member_id, buyInAmount, paymentMethod);
    setPending(false);
    router.refresh();
  }

  function handleMove(seat: Seat) {
    if (!game || !seat.member_id) return;
    const targetTableId = moveTarget ?? table.id;
    const n = prompt("이동할 좌석 번호 (1-11)");
    if (!n) return;
    const toSeat = Number(n);
    if (toSeat < 1 || toSeat > 11) {
      alert("좌석 번호는 1~11입니다.");
      return;
    }
    closeMenu();
    setPending(true);
    moveSeat(game.id, seat.member_id, targetTableId, toSeat).then((result) => {
      setPending(false);
      if (result && "error" in result && result.error) alert(result.error);
      setMoveTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0 gap-1.5">
      {!game && (
        <div className="glass-panel rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
          <p className="text-sm text-on-surface-variant flex-1">연결된 게임이 없습니다.</p>
          <button
            type="button"
            disabled={pending || !preset}
            onClick={handleQuickStart}
            className="btn-primary px-4 py-2 rounded-lg text-sm"
          >
            빠른 게임 시작
          </button>
          <Link href="/admin/games/new" className="text-sm text-primary hover:underline">
            상세 개설 →
          </Link>
        </div>
      )}

      {game && (
        <>
          <TableGameHudBar
            game={game}
            clock={clock}
            preset={preset}
            blindName={preset?.name}
          />
          <div className="table-detail-table-area">
            <div className="table-detail-table-wrap">
              <PokerTableOval
                tableCode={table.code}
                seats={seats}
                floor
                showRebuyCount
                onSeatClick={handleSeatClick}
              />
              {menu?.kind === "assign" && (
                <SeatAssignPopover
                  seatNumber={menu.seatNumber}
                  visits={unseatedVisits}
                  pending={pending}
                  onSelect={handleAssign}
                  onClose={closeMenu}
                />
              )}
              {menu?.kind === "occupied" && (
                <SeatOccupiedMenu
                  seat={menu.seat}
                  otherTables={otherTables}
                  moveTarget={moveTarget}
                  onMoveTargetChange={setMoveTarget}
                  onRebuy={() => handleManualRebuy(menu.seat)}
                  onMove={() => handleMove(menu.seat)}
                  onSitOut={() => handleSitOut(menu.seat)}
                  onClose={closeMenu}
                  pending={pending}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
