"use client";

import { SeatAnchoredPopover } from "@/components/tables/SeatAnchoredPopover";
import type { MemberVisitWithMember } from "@/lib/types";

type Props = {
  seatNumber: number;
  visits: MemberVisitWithMember[];
  pending: boolean;
  onSelect: (visit: MemberVisitWithMember) => void;
  onClose: () => void;
};

export function SeatAssignPopover({
  seatNumber,
  visits,
  pending,
  onSelect,
  onClose,
}: Props) {
  return (
    <SeatAnchoredPopover
      seatNumber={seatNumber}
      title={`좌석 ${seatNumber} · 배정`}
      onClose={onClose}
      widthClass="w-48 sm:w-56"
    >
      <p className="shrink-0 px-3 py-1.5 text-[10px] text-on-surface-variant border-b border-white/5">
        방문 중 손님
      </p>
      <ul className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1 max-h-56">
        {visits.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => onSelect(v)}
              className="w-full text-left px-2.5 py-2 rounded-lg bg-surface-container-high hover:bg-primary/20 text-sm disabled:opacity-50"
            >
              <span className="font-semibold">{v.members?.nickname ?? v.member_id}</span>
              {v.members && v.members.credit_balance < 0 && (
                <span className="block text-error text-[10px] mt-0.5">
                  외상 {v.members.credit_balance.toLocaleString()}
                </span>
              )}
            </button>
          </li>
        ))}
        {visits.length === 0 && (
          <li className="text-xs text-on-surface-variant text-center py-4 px-1">
            배정 가능한 방문 손님이 없습니다.
          </li>
        )}
      </ul>
    </SeatAnchoredPopover>
  );
}
