"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { PaymentMethod } from "@/lib/actions/ledger";
import {
  collectSeatedMemberIds,
  filterAssignableVisits,
} from "@/lib/games/assignable-visits";
import type {
  GameClock,
  MemberVisitWithMember,
  PhysicalTable,
  Seat,
  Game,
  GamePreset,
} from "@/lib/types";

type Props = {
  table: PhysicalTable;
  game: Game | null;
  seats: Seat[];
  activeVisits: MemberVisitWithMember[];
  inGameMemberIds: string[];
  preset: GamePreset | null;
  clock: GameClock | null;
  defaultBuyIn: number;
  allTables: PhysicalTable[];
  gameSeats: Seat[];
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
  inGameMemberIds,
  preset,
  clock,
  defaultBuyIn,
  allTables,
  gameSeats,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menu, setMenu] = useState<SeatMenu>(null);
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

  const unseatedVisits = useMemo(() => {
    if (!game) return [];
    const seated = new Set(inGameMemberIds);
    for (const id of collectSeatedMemberIds(gameSeats)) seated.add(id);
    return filterAssignableVisits(activeVisits, seated);
  }, [activeVisits, game, gameSeats, inGameMemberIds]);

  const moveTables = useMemo(() => {
    if (!game?.id) return [];
    return allTables
      .filter((t) => t.current_game_id === game.id)
      .map((t) => ({ id: t.id, code: t.code }));
  }, [allTables, game?.id]);

  const occupiedSeatsByTable = useMemo(() => {
    if (!game?.id) return {};
    const map: Record<string, number[]> = {};
    for (const s of gameSeats) {
      if (!s.member_id || !s.physical_table_id) continue;
      if (!map[s.physical_table_id]) map[s.physical_table_id] = [];
      map[s.physical_table_id].push(s.seat_number);
    }
    return map;
  }, [game?.id, gameSeats]);

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

  async function handleAssign(visit: MemberVisitWithMember, paymentMethod: PaymentMethod) {
    if (!game || menu?.kind !== "assign") return;
    setPending(true);
    const result = await assignSeatWithBuyIn(
      game.id,
      table.id,
      menu.seatNumber,
      visit.member_id,
      defaultBuyIn,
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
    setPending(true);
    const result = await sitOutPlayer(seat.member_id, game.id);
    setPending(false);
    if (result && "error" in result && result.error) {
      alert(result.error);
      return;
    }
    closeMenu();
    router.refresh();
  }

  async function handleManualRebuy(seat: Seat, paymentMethod: PaymentMethod) {
    if (!game || !seat.member_id) return;
    setPending(true);
    const result = await manualRebuy(
      game.id,
      seat.id,
      seat.member_id,
      defaultBuyIn,
      paymentMethod,
    );
    setPending(false);
    if (result && "error" in result && result.error) {
      alert(result.error);
      return;
    }
    closeMenu();
    router.refresh();
  }

  async function handleMove(seat: Seat, toTableId: string, toSeatNumber: number) {
    if (!game || !seat.member_id) return;
    closeMenu();
    setPending(true);
    const result = await moveSeat(game.id, seat.member_id, toTableId, toSeatNumber);
    setPending(false);
    if (result && "error" in result && result.error) alert(result.error);
    router.refresh();
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
            <div className="table-detail-table-wrap" data-table-anchor={table.id}>
              <PokerTableOval
                tableCode={table.code}
                seats={seats}
                floor
                onSeatClick={handleSeatClick}
              />
              {menu?.kind === "assign" && (
                <SeatAssignPopover
                  seatNumber={menu.seatNumber}
                  anchorScopeId={table.id}
                  visits={unseatedVisits}
                  pending={pending}
                  onAssign={handleAssign}
                  onClose={closeMenu}
                />
              )}
              {menu?.kind === "occupied" && (
                <SeatOccupiedMenu
                  seat={menu.seat}
                  gameId={game.id}
                  fromTableId={table.id}
                  moveTables={moveTables}
                  occupiedSeatsByTable={occupiedSeatsByTable}
                  onRebuyConfirm={(paymentMethod) => handleManualRebuy(menu.seat, paymentMethod)}
                  onMove={(toTableId, toSeat) => handleMove(menu.seat, toTableId, toSeat)}
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
