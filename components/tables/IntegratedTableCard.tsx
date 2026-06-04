"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PokerTableOval } from "@/components/poker/PokerTableOval";
import { IntegratedSeatPicker } from "@/components/tables/IntegratedSeatPicker";
import { quickEndGameOnTable, assignSeatWithBuyIn } from "@/lib/actions/games";
import {
  formatIntegratedBlinds,
  type IntegratedTableItem,
} from "@/lib/tables/integrated-table";
import type { MemberVisitWithMember } from "@/lib/types";
import type { PaymentMethod } from "@/lib/actions/ledger";

type Props = {
  table: IntegratedTableItem;
  defaultPresetId?: string;
  defaultBuyIn: number;
  activeVisits: MemberVisitWithMember[];
  onStartGame: (tableId: string) => void;
};

export function IntegratedTableCard({
  table,
  defaultBuyIn,
  activeVisits,
  onStartGame,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [pickerSeat, setPickerSeat] = useState<number | null>(null);
  const [buyInAmount, setBuyInAmount] = useState(defaultBuyIn);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const blindText = formatIntegratedBlinds(table);

  const unseatedVisits = useMemo(() => {
    if (!table.gameId) return [];
    const seated = new Set(
      table.seats.filter((s) => s.member_id).map((s) => s.member_id),
    );
    return activeVisits.filter((v) => !seated.has(v.member_id));
  }, [activeVisits, table.gameId, table.seats]);

  async function handleEndGame() {
    if (!confirm("게임을 종료할까요? (임시 — 프라이즈 정산 없음)")) return;
    setPending(true);
    const result = await quickEndGameOnTable(table.tableId);
    setPending(false);
    if (result && "error" in result && result.error) {
      alert(result.error);
      return;
    }
    setPickerSeat(null);
    router.refresh();
  }

  function handleSeatClick(seatNumber: number) {
    if (!table.hasGame || !table.gameId) {
      alert("게임을 먼저 생성해 주세요.");
      return;
    }
    const seat = table.seats.find((s) => s.seat_number === seatNumber);
    if (seat?.member_id) {
      alert("이미 착석한 좌석입니다. 상세 화면에서 관리하세요.");
      return;
    }
    setPickerSeat(seatNumber);
    setBuyInAmount(defaultBuyIn);
  }

  async function handleAssign(visit: MemberVisitWithMember) {
    if (!table.gameId || pickerSeat === null) return;
    setPending(true);
    const result = await assignSeatWithBuyIn(
      table.gameId,
      table.tableId,
      pickerSeat,
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
    setPickerSeat(null);
    router.refresh();
  }

  return (
    <article
      className={`integrated-table-unit relative glass-panel rounded-2xl p-2 md:p-3 flex flex-col min-h-0 h-full overflow-hidden transition-all duration-300 ${
        table.isRunning ? "card-running" : ""
      }`}
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
            <span className="text-on-surface-variant">엔트리 </span>
            <span className="stat-display text-sm">{table.entryCount}</span>
            <span className="text-on-surface-variant/80"> · 생존 {table.survivorCount}</span>
          </div>
          <div className="text-on-surface-variant">착석 {table.occupied}/11</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center relative mt-1 overflow-visible">
        <div className="w-full h-full integrated-table-oval-wrap overflow-visible">
          <PokerTableOval
            tableCode={table.code}
            seats={table.hasGame ? table.seats : []}
            floor
            integratedFloor
            showRebuyCount
            onSeatClick={handleSeatClick}
          />
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

      {pickerSeat !== null && (
        <IntegratedSeatPicker
          seatNumber={pickerSeat}
          tableLabel={table.name}
          visits={unseatedVisits}
          buyInAmount={buyInAmount}
          paymentMethod={paymentMethod}
          pending={pending}
          onBuyInAmountChange={setBuyInAmount}
          onPaymentMethodChange={setPaymentMethod}
          onSelect={handleAssign}
          onClose={() => setPickerSeat(null)}
        />
      )}
    </article>
  );
}
