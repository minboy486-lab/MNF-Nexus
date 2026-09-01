"use client";

import { useState } from "react";
import type { PaymentMethod } from "@/lib/actions/ledger";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/ledger/payment-methods";
import type { MemberVisitWithMember } from "@/lib/types";
import { formatPaymentDue } from "@/lib/utils/payment-due";

type Props = {
  seatNumber: number;
  tableLabel: string;
  visits: MemberVisitWithMember[];
  pending: boolean;
  onAssign: (visit: MemberVisitWithMember, paymentMethod: PaymentMethod) => void;
  onClose: () => void;
};

type Step = "guest" | "payment";

export function IntegratedSeatPicker({
  seatNumber,
  tableLabel,
  visits,
  pending,
  onAssign,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>("guest");
  const [selectedVisit, setSelectedVisit] = useState<MemberVisitWithMember | null>(null);

  function handleGuestSelect(visit: MemberVisitWithMember) {
    setSelectedVisit(visit);
    setStep("payment");
  }

  function handlePaymentSelect(method: PaymentMethod) {
    if (!selectedVisit) return;
    onAssign(selectedVisit, method);
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-2 rounded-3xl seat-picker-overlay overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="seat-popover-panel w-full max-w-sm max-h-full my-auto flex flex-col rounded-xl border border-primary/30 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#1c1a22]">
          <h4 className="text-sm font-bold">
            {tableLabel} · 좌석 {seatNumber}
            {step === "payment" && selectedVisit && (
              <span className="block text-[11px] font-normal text-on-surface-variant mt-0.5">
                {selectedVisit.members?.nickname ?? selectedVisit.member_id}
              </span>
            )}
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

        {step === "guest" ? (
          <div className="seat-popover-body flex flex-col flex-1 min-h-0">
            <p className="shrink-0 px-3 py-2 text-[11px] text-on-surface-variant border-b border-white/5 bg-[#141218]">
              방문 중 손님 선택
            </p>
            <ul className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1 bg-[#141218]">
              {visits.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleGuestSelect(v)}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-[#1e1c26] hover:bg-[#282630] text-sm disabled:opacity-50 border border-white/10"
                  >
                    <span className="font-semibold">{v.members?.nickname ?? v.member_id}</span>
                    {v.members?.display_name && (
                      <span className="text-xs text-on-surface-variant ml-1">
                        ({v.members.display_name})
                      </span>
                    )}
                    {v.members && formatPaymentDue(v.members.credit_balance) && (
                      <span className="block text-error text-xs mt-0.5">
                        결제할 금액 {formatPaymentDue(v.members.credit_balance)}
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
        ) : (
          <div className="seat-popover-body flex flex-col flex-1 min-h-0 p-3 gap-2 overflow-y-auto">
            <button
              type="button"
              onClick={() => setStep("guest")}
              className="shrink-0 text-[10px] text-left text-on-surface-variant hover:text-primary"
            >
              ‹ 손님 다시 선택
            </button>
            <p className="shrink-0 text-[11px] text-on-surface-variant">결제 방식</p>
            <div className="flex flex-col gap-1 shrink-0">
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={pending}
                  onClick={() => handlePaymentSelect(opt.value)}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-semibold border disabled:opacity-50 transition-colors ${
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
      </div>
    </div>
  );
}
