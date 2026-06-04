"use client";

import { MpNumericInput } from "@/components/ui/MpNumericInput";
import type { MemberVisitWithMember } from "@/lib/types";
import type { PaymentMethod } from "@/lib/actions/ledger";

type Props = {
  seatNumber: number;
  tableLabel: string;
  visits: MemberVisitWithMember[];
  buyInAmount: number;
  paymentMethod: PaymentMethod;
  pending: boolean;
  onBuyInAmountChange: (n: number) => void;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  onSelect: (visit: MemberVisitWithMember) => void;
  onClose: () => void;
};

export function IntegratedSeatPicker({
  seatNumber,
  tableLabel,
  visits,
  buyInAmount,
  paymentMethod,
  pending,
  onBuyInAmountChange,
  onPaymentMethodChange,
  onSelect,
  onClose,
}: Props) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-2 rounded-3xl bg-black/70"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-sm max-h-[85%] flex flex-col rounded-xl border border-primary/30 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10">
          <h4 className="text-sm font-bold">
            {tableLabel} · 좌석 {seatNumber}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-on-surface-variant"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="shrink-0 flex flex-wrap gap-2 px-3 py-2 border-b border-white/5 text-xs">
          <label className="flex items-center gap-1.5 text-on-surface-variant">
            바이인
            <MpNumericInput
              valueWon={buyInAmount}
              onChangeWon={onBuyInAmountChange}
              className="login-input w-20 py-1 text-xs"
              aria-label="바이인 MP"
            />
            <span className="text-[10px]">MP</span>
          </label>
          <label className="flex items-center gap-1 text-on-surface-variant">
            결제
            <select
              value={paymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value as PaymentMethod)}
              className="login-input py-1 text-xs"
            >
              <option value="cash">현금</option>
              <option value="card">카드</option>
              <option value="transfer">계좌</option>
              <option value="points">포인트</option>
              <option value="credit">외상</option>
            </select>
          </label>
        </div>

        <p className="shrink-0 px-3 py-1.5 text-[11px] text-on-surface-variant">방문 중 손님</p>
        <ul className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1">
          {visits.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onSelect(v)}
                className="w-full text-left px-3 py-2 rounded-lg bg-surface-container-high hover:bg-primary/20 text-sm disabled:opacity-50"
              >
                <span className="font-semibold">{v.members?.nickname ?? v.member_id}</span>
                {v.members?.display_name && (
                  <span className="text-xs text-on-surface-variant ml-1">
                    ({v.members.display_name})
                  </span>
                )}
                {v.members && v.members.credit_balance < 0 && (
                  <span className="block text-error text-xs mt-0.5">
                    외상 {v.members.credit_balance.toLocaleString()}
                  </span>
                )}
              </button>
            </li>
          ))}
          {visits.length === 0 && (
            <li className="text-sm text-on-surface-variant text-center py-6 px-2">
              배정 가능한 방문 손님이 없습니다.
              <br />
              손님 관리에서 방문 중으로 올려 주세요.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
