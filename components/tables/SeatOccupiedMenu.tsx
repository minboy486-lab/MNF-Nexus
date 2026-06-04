"use client";

import { SeatAnchoredPopover } from "@/components/tables/SeatAnchoredPopover";
import type { PhysicalTable, Seat } from "@/lib/types";

type Props = {
  seat: Seat;
  otherTables: PhysicalTable[];
  moveTarget: string | null;
  onMoveTargetChange: (id: string | null) => void;
  onRebuy: () => void;
  onMove: () => void;
  onSitOut: () => void;
  onClose: () => void;
  pending?: boolean;
};

export function SeatOccupiedMenu({
  seat,
  otherTables,
  moveTarget,
  onMoveTargetChange,
  onRebuy,
  onMove,
  onSitOut,
  onClose,
  pending,
}: Props) {
  const nickname = seat.members?.nickname ?? "Player";

  return (
    <SeatAnchoredPopover
      seatNumber={seat.seat_number}
      title={`S${seat.seat_number} ${nickname}`}
      onClose={onClose}
      widthClass="w-40 sm:w-44"
    >
      <div className="p-2 flex flex-col gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={onRebuy}
          className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/25 disabled:opacity-50"
        >
          리바인
        </button>
        {otherTables.length > 0 && (
          <select
            value={moveTarget ?? ""}
            onChange={(e) => onMoveTargetChange(e.target.value || null)}
            className="login-input text-[10px] py-1 mb-0.5"
            aria-label="이동할 테이블"
          >
            <option value="">테이블 선택</option>
            {otherTables.map((t) => (
              <option key={t.id} value={t.id}>
                테이블 {t.code}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={onMove}
          className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold bg-surface-container-high hover:bg-white/10 border border-white/10 disabled:opacity-50"
        >
          자리이동
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSitOut}
          className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold bg-error/10 hover:bg-error/20 text-error border border-error/30 disabled:opacity-50"
        >
          싯아웃
        </button>
      </div>
    </SeatAnchoredPopover>
  );
}
