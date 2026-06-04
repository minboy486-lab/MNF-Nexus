"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closePayrollPeriod } from "@/lib/actions/staff";

type PayrollLine = {
  staffId: string;
  name: string;
  hourlyWage: number;
  hours: number;
  gross: number;
  advances: number;
  net: number;
};

type Props = {
  yearMonth: string;
  revenue: number;
  expenses: number;
  payroll: PayrollLine[];
  payrollNet: number;
  winPoints: { nickname: string; points: number }[];
  configured: boolean;
};

export function MonthlySettlementClient({
  yearMonth,
  revenue,
  expenses,
  payroll,
  payrollNet,
  winPoints,
  configured,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const profit = revenue - expenses - payrollNet;

  async function handleClosePayroll() {
    setPending(true);
    const result = await closePayrollPeriod(yearMonth);
    setPending(false);
    if (result?.error) alert(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs text-on-surface-variant">게임 매출(바인)</p>
          <p className="stat-display text-xl text-primary mt-1">{revenue.toLocaleString()}</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs text-on-surface-variant">매장 지출</p>
          <p className="stat-display text-xl text-error mt-1">{expenses.toLocaleString()}</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs text-on-surface-variant">급여(실지급)</p>
          <p className="stat-display text-xl text-tertiary mt-1">{payrollNet.toLocaleString()}</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs text-on-surface-variant">순이익(추정)</p>
          <p className={`stat-display text-xl mt-1 ${profit >= 0 ? "text-emerald-400" : "text-error"}`}>
            {profit.toLocaleString()}
          </p>
        </div>
      </div>

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="font-bold mb-4">직원 급여 ({yearMonth})</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-on-surface-variant border-b border-white/10">
              <th className="text-left pb-2">이름</th>
              <th className="text-right pb-2">시간</th>
              <th className="text-right pb-2">총액</th>
              <th className="text-right pb-2">가불</th>
              <th className="text-right pb-2">실지급</th>
            </tr>
          </thead>
          <tbody>
            {payroll.map((line) => (
              <tr key={line.staffId} className="border-b border-white/5">
                <td className="py-2">{line.name}</td>
                <td className="py-2 text-right">{line.hours}h</td>
                <td className="py-2 text-right font-mono">{line.gross.toLocaleString()}</td>
                <td className="py-2 text-right font-mono text-error">−{line.advances.toLocaleString()}</td>
                <td className="py-2 text-right font-mono text-primary">{line.net.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {configured && (
          <button
            type="button"
            disabled={pending}
            onClick={handleClosePayroll}
            className="btn-primary mt-4 px-6 py-2 rounded-lg text-sm"
          >
            월 급여 정산 확정
          </button>
        )}
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="font-bold mb-4">승점 리더보드 (당월)</h2>
        <ol className="space-y-2">
          {winPoints.map((w, i) => (
            <li key={w.nickname} className="flex justify-between text-sm">
              <span>
                {i + 1}. {w.nickname}
              </span>
              <span className="text-primary font-mono">{w.points} pt</span>
            </li>
          ))}
          {winPoints.length === 0 && (
            <p className="text-on-surface-variant text-sm">승점 기록 없음</p>
          )}
        </ol>
      </section>
    </div>
  );
}
