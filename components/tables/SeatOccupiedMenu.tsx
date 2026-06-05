"use client";

import { useEffect, useState } from "react";
import { fetchMemberBuyInLogs } from "@/lib/actions/games";
import type { PaymentMethod } from "@/lib/actions/ledger";
import { SeatAnchoredPopover } from "@/components/tables/SeatAnchoredPopover";
import type { BuyInLogEntry } from "@/lib/data/seat-enrichment";
import { getPaymentMethodLabel, PAYMENT_METHOD_OPTIONS } from "@/lib/ledger/payment-methods";
import { formatMp } from "@/lib/utils/mp";
import type { Seat } from "@/lib/types";

export type MoveTableOption = {
  id: string;
  code: string;
};

type Props = {
  seat: Seat;
  fromTableId: string;
  moveTables: MoveTableOption[];
  occupiedSeatsByTable: Record<string, number[]>;
  gameId: string;
  onRebuyConfirm: (paymentMethod: PaymentMethod) => void;
  onMove: (toTableId: string, toSeatNumber: number) => void;
  onSitOut: () => void;
  onClose: () => void;
  pending?: boolean;
};

type Step = "menu" | "move" | "rebuy-payment" | "rebuy";

function isCreditSeat(seat: Seat) {
  const method = seat.first_payment_method ?? seat.last_payment_method;
  return method === "credit";
}

function formatLogTime(iso: string) {
  const d = new Date(iso);
  const hours = d.getHours();
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = String(hours % 12 || 12).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${period} ${hour12}:${minute}`;
}

function actorLabel(log: BuyInLogEntry) {
  return log.actor_login_id ?? log.actor_name ?? "—";
}

export function SeatOccupiedMenu({
  seat,
  fromTableId,
  moveTables,
  occupiedSeatsByTable,
  gameId,
  onRebuyConfirm,
  onMove,
  onSitOut,
  onClose,
  pending,
}: Props) {
  const nickname = seat.members?.nickname ?? "Player";
  const [step, setStep] = useState<Step>("menu");
  const [targetTableId, setTargetTableId] = useState(fromTableId);
  const [buyInLogs, setBuyInLogs] = useState<BuyInLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const creditSeat = isCreditSeat(seat);

  const occupied = new Set(occupiedSeatsByTable[targetTableId] ?? []);

  useEffect(() => {
    if (step !== "rebuy" || !seat.member_id) return;
    let cancelled = false;
    setLogsLoading(true);
    fetchMemberBuyInLogs(gameId, seat.member_id)
      .then((logs) => {
        if (!cancelled) setBuyInLogs(logs);
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, gameId, seat.member_id]);

  function isSeatAvailable(seatNum: number) {
    if (targetTableId === fromTableId && seatNum === seat.seat_number) return false;
    return !occupied.has(seatNum);
  }

  const widthClass =
    step === "move"
      ? "w-52 sm:w-56"
      : step === "rebuy" || step === "rebuy-payment"
        ? "w-52 sm:w-60"
        : "w-40 sm:w-44";

  return (
    <SeatAnchoredPopover
      seatNumber={seat.seat_number}
      title={`S${seat.seat_number} ${nickname}`}
      onClose={onClose}
      widthClass={widthClass}
    >
      {step === "menu" && (
        <div className="p-2 flex flex-col gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => setStep("rebuy")}
            className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold bg-[#2a1f2a] hover:bg-[#352535] text-primary border border-primary/40 disabled:opacity-50"
          >
            리바인
          </button>
          <button
            type="button"
            disabled={pending || moveTables.length === 0}
            onClick={() => {
              setTargetTableId(fromTableId);
              setStep("move");
            }}
            className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold bg-[#1e1c26] hover:bg-[#282630] border border-white/15 disabled:opacity-50"
          >
            자리이동
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onSitOut}
            className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold bg-[#2a181c] hover:bg-[#351f24] text-error border border-error/40 disabled:opacity-50"
          >
            싯아웃
          </button>
        </div>
      )}

      {step === "rebuy-payment" && (
        <div className="p-2 flex flex-col gap-1.5 min-h-0">
          <button
            type="button"
            onClick={() => setStep("rebuy")}
            className="shrink-0 text-[10px] text-left text-on-surface-variant hover:text-primary"
          >
            ‹ 리바인
          </button>
          <p className="shrink-0 text-xs font-semibold text-on-surface">리바인 결제 방식</p>
          <div className="flex flex-col gap-1">
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={pending}
                onClick={() => onRebuyConfirm(opt.value)}
                className={`w-full py-1.5 px-3 rounded-lg text-sm font-semibold border disabled:opacity-50 transition-colors ${
                  opt.value === "credit"
                    ? "bg-[#2a1f2a] hover:bg-[#352535] text-primary border-primary/40"
                    : "bg-[#1e1c26] hover:bg-[#282630] border-white/15"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "rebuy" && (
        <div className="p-2 flex flex-col gap-2 max-h-64">
          <button
            type="button"
            onClick={() => setStep("menu")}
            className="text-[10px] text-left text-on-surface-variant hover:text-primary"
          >
            ‹ 메뉴
          </button>
          <p className="text-xs font-semibold text-on-surface">리바인 하시겠습니까?</p>
          <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1820] p-2 space-y-1.5">
            <p className="text-[10px] text-on-surface-variant sticky top-0 bg-[#1a1820] pb-1">
              바인 로그
            </p>
            {logsLoading && (
              <p className="text-[10px] text-on-surface-variant text-center py-3">불러오는 중…</p>
            )}
            {!logsLoading && buyInLogs.length === 0 && (
              <p className="text-[10px] text-on-surface-variant text-center py-3">
                바인 기록이 없습니다.
              </p>
            )}
            {!logsLoading &&
              buyInLogs.map((log) => (
                <div
                  key={log.id}
                  className="text-[10px] leading-snug text-on-surface-variant border-b border-white/5 pb-1.5 last:border-0"
                >
                  <p>
                    <span className="text-on-surface font-semibold">{log.sequence}</span>
                    <span className="mx-1">·</span>
                    <span className="text-on-surface">{formatLogTime(log.occurred_at)}</span>
                    <span className="mx-1">·</span>
                    <span>{formatMp(log.amount)}</span>
                    <span className="mx-1">·</span>
                    <span>{getPaymentMethodLabel(log.payment_method)}</span>
                    {log.is_initial && (
                      <>
                        <span className="mx-1">·</span>
                        <span className="text-secondary">최초 바인</span>
                      </>
                    )}
                  </p>
                  <p className="text-primary mt-0.5">담당자 : {actorLabel(log)}</p>
                </div>
              ))}
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (creditSeat) {
                  onRebuyConfirm("credit");
                } else {
                  setStep("rebuy-payment");
                }
              }}
              className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold bg-[#2a1f2a] hover:bg-[#352535] text-primary border border-primary/40 disabled:opacity-50"
            >
              리바인
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStep("menu")}
              className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold bg-[#1e1c26] hover:bg-[#282630] border border-white/15 disabled:opacity-50"
            >
              리바인 취소
            </button>
          </div>
        </div>
      )}

      {step === "move" && (
        <div className="p-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setStep("menu")}
            className="text-[10px] text-left text-on-surface-variant hover:text-primary"
          >
            ‹ 메뉴
          </button>
          <label className="text-[10px] text-on-surface-variant">테이블</label>
          <select
            value={targetTableId}
            onChange={(e) => setTargetTableId(e.target.value)}
            className="login-input text-xs py-1.5"
            aria-label="이동할 테이블"
          >
            {moveTables.map((t) => (
              <option key={t.id} value={t.id}>
                테이블 {t.code}
              </option>
            ))}
          </select>
          <label className="text-[10px] text-on-surface-variant">좌석 번호</label>
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 11 }, (_, i) => i + 1).map((num) => {
              const available = isSeatAvailable(num);
              return (
                <button
                  key={num}
                  type="button"
                  disabled={pending || !available}
                  onClick={() => onMove(targetTableId, num)}
                  className={`py-1.5 rounded-md text-xs font-bold border transition-colors ${
                    available
                      ? "border-primary/40 bg-[#2a1f2a] hover:bg-[#352535] text-primary"
                      : "border-white/10 bg-[#1a1820] text-on-surface-variant/50 cursor-not-allowed"
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </SeatAnchoredPopover>
  );
}
