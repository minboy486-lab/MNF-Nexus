"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeDailyCloseout } from "@/lib/actions/settlement";
import type { SessionLedgerTotals } from "@/lib/actions/settlement";
import type { VenueSession } from "@/lib/types";
import { formatMp } from "@/lib/utils/mp";

type GameLine = {
  gameId: string;
  label: string;
  status: string;
  buyIn: number;
  prize: number;
  balance: number;
};

type CreditMember = {
  id: string;
  nickname: string;
  phone: string | null;
  credit_balance: number;
};

type Props = {
  session: VenueSession | null;
  totals: SessionLedgerTotals | null;
  gameLines: GameLine[];
  creditMembers: CreditMember[];
  configured: boolean;
};

export function DailySettlementClient({
  session,
  totals,
  gameLines,
  creditMembers,
  configured,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  if (!configured) {
    return (
      <p className="text-on-surface-variant glass-panel p-6 rounded-xl">
        Supabase 연결 후 일일 정산을 사용할 수 있습니다.
      </p>
    );
  }

  if (!session) {
    return (
      <p className="text-error glass-panel p-6 rounded-xl">
        열린 영업 세션이 없습니다. 대시보드에서 영업을 시작하세요.
      </p>
    );
  }

  const buyInTotal = (totals?.totalBuyIn ?? 0) + (totals?.totalRebuy ?? 0);
  const ok = totals?.balanceDelta === 0;

  async function handleFinalize() {
    if (!confirm("일일 정산을 확정하시겠습니까?")) return;
    setPending(true);
    const result = await finalizeDailyCloseout(notes);
    setPending(false);
    if (result?.error) alert(result.error);
    else {
      alert(ok ? "대차 OK (0)" : `대차 차이: ${formatMp(totals?.balanceDelta ?? 0)}`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <section className="glass-panel rounded-2xl p-6">
        <h2 className="font-bold mb-4">대차 검증</h2>
        <p className="text-xs text-on-surface-variant mb-4">
          바인 = 프라이즈 + 현금 + 카드 + 계좌 + 포인트순변동 + 외상회수 − 신규외상
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>바인+리바인</div>
          <div className="text-right font-mono">{formatMp(buyInTotal)}</div>
          <div>프라이즈</div>
          <div className="text-right font-mono">{formatMp(totals?.totalPrize ?? 0)}</div>
          <div>현금</div>
          <div className="text-right font-mono">{formatMp(totals?.totalCash ?? 0)}</div>
          <div>카드</div>
          <div className="text-right font-mono">{formatMp(totals?.totalCard ?? 0)}</div>
          <div>계좌</div>
          <div className="text-right font-mono">{formatMp(totals?.totalTransfer ?? 0)}</div>
          <div>포인트 순변동</div>
          <div className="text-right font-mono">{formatMp(totals?.totalPointNet ?? 0)}</div>
          <div>결제할 금액 회수 / 신규</div>
          <div className="text-right font-mono">
            {formatMp(totals?.totalCreditCollected ?? 0, { suffix: false })} / −
            {formatMp(totals?.totalCreditNew ?? 0, { suffix: false })} MP
          </div>
        </div>
        <p
          className={`mt-6 text-2xl font-bold stat-display ${ok ? "text-emerald-400" : "text-error"}`}
        >
          balance Δ {formatMp(totals?.balanceDelta ?? 0, { suffix: false })} MP
          {ok ? " ✓" : " — 확인 필요"}
        </p>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="font-bold mb-4">게임별</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-on-surface-variant text-left border-b border-white/10">
              <th className="pb-2">게임</th>
              <th className="pb-2 text-right">바인</th>
              <th className="pb-2 text-right">프라이즈</th>
              <th className="pb-2 text-right">차액</th>
            </tr>
          </thead>
          <tbody>
            {gameLines.map((line) => (
              <tr key={line.gameId} className="border-b border-white/5">
                <td className="py-2">{line.label}</td>
                <td className="py-2 text-right font-mono">{formatMp(line.buyIn)}</td>
                <td className="py-2 text-right font-mono">{formatMp(line.prize)}</td>
                <td className="py-2 text-right font-mono">{formatMp(line.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="font-bold mb-4">누적 외상 현황</h2>
        {creditMembers.length === 0 ? (
          <p className="text-sm text-on-surface-variant">외상 회원 없음</p>
        ) : (
          <ul className="space-y-2">
            {creditMembers.map((m) => (
              <li key={m.id} className="flex justify-between text-sm">
                <span>{m.nickname}</span>
                <span className="text-error font-mono">{formatMp(m.credit_balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div>
        <label className="text-xs text-on-surface-variant block mb-2">메모</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="login-input w-full min-h-[80px]"
        />
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={handleFinalize}
        className="btn-primary px-8 py-3 rounded-lg"
      >
        일일 정산 스냅샷 저장
      </button>
    </div>
  );
}
