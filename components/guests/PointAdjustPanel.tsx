"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Member } from "@/lib/types";
import { adjustMemberPoints } from "@/lib/actions/points";
import { formatMp } from "@/lib/utils/mp";
import { formatPaymentDue } from "@/lib/utils/payment-due";

type Props = {
  member: Member | null;
};

export function PointAdjustPanel({ member }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "deduct">("add");
  const [mp, setMp] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!member) {
    return (
      <section className="glass-panel rounded-xl p-4 border border-white/5 shrink-0">
        <p className="text-sm text-on-surface-variant">손님을 선택하면 MP를 조정할 수 있습니다.</p>
      </section>
    );
  }

  const paymentDue = formatPaymentDue(member.credit_balance);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    const value = Number(mp);
    if (!Number.isFinite(value) || value <= 0) {
      setError("0보다 큰 MP를 입력하세요.");
      return;
    }
    setPending(true);
    setError(null);
    setSuccess(null);
    const deltaMp = mode === "add" ? value : -value;
    const result = await adjustMemberPoints({
      memberId: member.id,
      deltaMp,
      note: note.trim() || undefined,
    });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setMp("");
    setNote("");
    setSuccess(
      mode === "add"
        ? `${value.toLocaleString("ko-KR")} MP를 추가했습니다.`
        : `${value.toLocaleString("ko-KR")} MP를 차감했습니다.`,
    );
    router.refresh();
  }

  return (
    <section className="glass-panel rounded-xl p-4 border border-white/5 shrink-0">
      <header className="mb-3">
        <h2 className="font-bold text-base flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
          MP 조정 — {member.nickname}
        </h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-on-surface-variant">잔액 </span>
            <span className="font-bold text-primary tabular-nums">{formatMp(member.point_balance)}</span>
          </div>
          {paymentDue && (
            <div>
              <span className="text-on-surface-variant">결제할 금액 </span>
              <span className="font-bold text-error tabular-nums">{paymentDue}</span>
            </div>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("add")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              mode === "add"
                ? "border-primary bg-primary/15 text-primary"
                : "border-white/10 text-on-surface-variant hover:bg-white/5"
            }`}
          >
            추가
          </button>
          <button
            type="button"
            onClick={() => setMode("deduct")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              mode === "deduct"
                ? "border-error bg-error/10 text-error"
                : "border-white/10 text-on-surface-variant hover:bg-white/5"
            }`}
          >
            차감
          </button>
        </div>

        <label className="block text-xs text-on-surface-variant">
          MP
          <input
            type="number"
            min={0}
            step={1}
            value={mp}
            onChange={(e) => setMp(e.target.value)}
            className="login-input w-full mt-1 text-sm py-2"
            placeholder="예: 5"
            disabled={pending}
          />
        </label>

        <label className="block text-xs text-on-surface-variant">
          메모 (선택)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="login-input w-full mt-1 text-sm py-2"
            placeholder="사유 메모"
            disabled={pending}
            maxLength={200}
          />
        </label>

        {error && <p className="text-error text-sm">{error}</p>}
        {success && <p className="text-primary text-sm">{success}</p>}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
        >
          {pending ? "처리 중…" : mode === "add" ? "MP 추가" : "MP 차감"}
        </button>
      </form>
    </section>
  );
}
