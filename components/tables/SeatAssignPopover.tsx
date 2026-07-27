"use client";

import { useState } from "react";
import { SeatAnchoredPopover } from "@/components/tables/SeatAnchoredPopover";
import type { PaymentMethod } from "@/lib/actions/ledger";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/ledger/payment-methods";
import type { MemberVisitWithMember } from "@/lib/types";
import { formatMp } from "@/lib/utils/mp";

type Props = {
  seatNumber: number;
  anchorScopeId: string;
  visits: MemberVisitWithMember[];
  pending: boolean;
  onAssign: (visit: MemberVisitWithMember, paymentMethod: PaymentMethod) => void;
  onClose: () => void;
};

type Step = "guest" | "payment";

export function SeatAssignPopover({
  seatNumber,
  anchorScopeId,
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

  const title =
    step === "payment" && selectedVisit
      ? `S${seatNumber} ${selectedVisit.members?.nickname ?? "손님"}`
      : `좌석 ${seatNumber} · 배정`;

  return (
    <SeatAnchoredPopover
      seatNumber={seatNumber}
      anchorScopeId={anchorScopeId}
      title={title}
      onClose={onClose}
      widthClass={step === "payment" ? "w-40 sm:w-44" : "w-48 sm:w-56"}
    >
      {step === "guest" ? (
        <>
          <p className="shrink-0 px-3 py-1.5 text-[10px] text-on-surface-variant border-b border-white/5">
            방문 중 손님
          </p>
          <ul className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1 max-h-56">
            {visits.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleGuestSelect(v)}
                  className="w-full text-left px-2.5 py-2 rounded-lg bg-[#1e1c26] hover:bg-[#282630] text-sm disabled:opacity-50 border border-white/10"
                >
                  <span className="font-semibold">{v.members?.nickname ?? v.member_id}</span>
                  {v.members && v.members.credit_balance < 0 && (
                    <span className="block text-error text-[10px] mt-0.5">
                      후불 {formatMp(v.members.credit_balance)}
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
        </>
      ) : (
        <div className="p-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setStep("guest")}
            className="shrink-0 text-[10px] text-left text-on-surface-variant hover:text-primary"
          >
            ‹ 손님 다시 선택
          </button>
          <p className="shrink-0 text-[10px] text-on-surface-variant">결제 방식</p>
          {PAYMENT_METHOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => handlePaymentSelect(opt.value)}
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
      )}
    </SeatAnchoredPopover>
  );
}
