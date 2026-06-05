"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PokerTableOval } from "@/components/poker/PokerTableOval";
import { IntegratedSeatPicker } from "@/components/tables/IntegratedSeatPicker";
import { SeatOccupiedMenu } from "@/components/tables/SeatOccupiedMenu";
import {
  quickEndGameOnTable,
  assignSeatWithBuyIn,
  manualRebuy,
  moveSeat,
  sitOutPlayer,
} from "@/lib/actions/games";
import type { PaymentMethod } from "@/lib/actions/ledger";
import {
  formatIntegratedBlinds,
  type IntegratedTableItem,
} from "@/lib/tables/integrated-table";
import {
  collectSeatedMemberIdsFromTables,
  filterAssignableVisits,
} from "@/lib/games/assignable-visits";
import type { MemberVisitWithMember, Seat } from "@/lib/types";

type Props = {
  table: IntegratedTableItem;
  defaultPresetId?: string;
  defaultBuyIn: number;
  activeVisits: MemberVisitWithMember[];
  inGameMemberIds: string[];
  allTables: IntegratedTableItem[];
  onStartGame: (tableId: string) => void;
  /** A테이블 확대 오버레이 */
  zoomed?: boolean;
};

type SeatMenu =
  | { kind: "assign"; seatNumber: number }
  | { kind: "occupied"; seat: Seat }
  | null;

export function IntegratedTableCard({
  table,
  defaultBuyIn,
  activeVisits,
  inGameMemberIds,
  allTables,
  onStartGame,
  zoomed,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [menu, setMenu] = useState<SeatMenu>(null);

  const blindText = formatIntegratedBlinds(table);

  const unseatedVisits = useMemo(() => {
    if (!table.gameId) return [];
    const seated = new Set(inGameMemberIds);
    for (const id of collectSeatedMemberIdsFromTables(allTables)) seated.add(id);
    return filterAssignableVisits(activeVisits, seated);
  }, [activeVisits, allTables, inGameMemberIds, table.gameId]);

  const moveTables = useMemo(() => {
    if (!table.gameId) return [];
    return allTables
      .filter((t) => t.gameId === table.gameId && t.hasGame)
      .map((t) => ({ id: t.tableId, code: t.code }));
  }, [allTables, table.gameId]);

  const occupiedSeatsByTable = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const t of allTables) {
      if (!t.gameId || t.gameId !== table.gameId) continue;
      map[t.tableId] = t.seats
        .filter((s) => s.member_id)
        .map((s) => s.seat_number);
    }
    return map;
  }, [allTables, table.gameId]);

  function closeMenu() {
    setMenu(null);
  }

  async function handleEndGame() {
    if (!confirm("게임을 종료할까요? (임시 — 프라이즈 정산 없음)")) return;
    setPending(true);
    const result = await quickEndGameOnTable(table.tableId);
    setPending(false);
    if (result && "error" in result && result.error) {
      alert(result.error);
      return;
    }
    closeMenu();
    router.refresh();
  }

  function handleSeatClick(seatNumber: number) {
    if (!table.hasGame || !table.gameId) {
      alert("게임을 먼저 생성해 주세요.");
      return;
    }
    const seat = table.seats.find((s) => s.seat_number === seatNumber);
    if (seat?.member_id) {
      setMenu({ kind: "occupied", seat });
      return;
    }
    setMenu({ kind: "assign", seatNumber });
  }

  async function handleAssign(visit: MemberVisitWithMember, paymentMethod: PaymentMethod) {
    if (!table.gameId || menu?.kind !== "assign") return;
    setPending(true);
    const result = await assignSeatWithBuyIn(
      table.gameId,
      table.tableId,
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
    if (!table.gameId || !seat.member_id) return;
    setPending(true);
    const result = await sitOutPlayer(seat.member_id, table.gameId);
    setPending(false);
    if (result && "error" in result && result.error) {
      alert(result.error);
      return;
    }
    closeMenu();
    router.refresh();
  }

  async function handleManualRebuy(seat: Seat, paymentMethod: PaymentMethod) {
    if (!table.gameId || !seat.member_id) return;
    setPending(true);
    const result = await manualRebuy(
      table.gameId,
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
    if (!table.gameId || !seat.member_id) return;
    closeMenu();
    setPending(true);
    const result = await moveSeat(table.gameId, seat.member_id, toTableId, toSeatNumber);
    setPending(false);
    if (result && "error" in result && result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <article
      className={`integrated-table-unit relative glass-panel rounded-2xl p-2 md:p-3 flex flex-col min-h-0 h-full transition-all duration-300 ${
        menu ? "overflow-visible z-20" : "overflow-hidden"
      } ${table.isRunning ? "card-running" : ""} ${zoomed ? "integrated-table-unit--zoomed" : ""}`}
    >
      <div className="flex justify-between items-start gap-2 shrink-0 text-[10px] md:text-xs z-10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-xs text-on-primary">
            {table.code}
          </div>
          <div className="min-w-0 leading-tight">
            <Link
              href={`/admin/tables/${table.tableId}`}
              className="font-bold text-sm md:text-base truncate hover:text-primary transition-colors block"
            >
              {table.name}
            </Link>
            {table.presetName && (
              <p
                className="text-[10px] md:text-xs font-semibold text-secondary truncate"
                title={table.presetName}
              >
                {table.presetName}
              </p>
            )}
            <span
              className={`font-mono tracking-wider text-[9px] md:text-[10px] ${
                table.isRunning ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              {table.statusLabel}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 leading-tight space-y-0.5 max-w-[48%]">
          <div>
            <span className="text-on-surface-variant">Lv{table.blindLevel ?? "—"}</span>
            <span className="text-primary font-mono ml-1">{blindText}</span>
          </div>
          <div>
            <span className="text-on-surface-variant">총 바인수 </span>
            <span className="stat-display text-sm">{table.totalBuyInCount}</span>
          </div>
          <div className="text-[10px] md:text-xs">
            <span className="text-on-surface-variant">현재 순위 : </span>
            <span className="text-on-surface font-semibold">{table.survivorCount}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center relative mt-1 overflow-visible">
        <div className="relative w-full h-full integrated-table-oval-wrap overflow-visible">
          <PokerTableOval
            tableCode={table.code}
            seats={table.hasGame ? table.seats : []}
            floor
            integratedFloor
            onSeatClick={handleSeatClick}
          />

          {menu?.kind === "occupied" && table.gameId && (
            <SeatOccupiedMenu
              seat={menu.seat}
              gameId={table.gameId}
              fromTableId={table.tableId}
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

        {!table.hasGame ? (
          <button
            type="button"
            onClick={() => onStartGame(table.tableId)}
            className="absolute z-20 flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl bg-primary/90 hover:bg-primary text-on-primary font-bold text-xs shadow-lg border border-white/20"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            게임 생성
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={handleEndGame}
            className="absolute z-20 flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl bg-surface-container-high hover:bg-error/30 text-on-surface font-bold text-xs shadow-lg border border-error/40 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xl text-error">remove</span>
            {pending ? "종료 중…" : "게임 종료"}
          </button>
        )}
      </div>

      {menu?.kind === "assign" && (
        <IntegratedSeatPicker
          seatNumber={menu.seatNumber}
          tableLabel={table.name}
          visits={unseatedVisits}
          pending={pending}
          onAssign={handleAssign}
          onClose={closeMenu}
        />
      )}
    </article>
  );
}
