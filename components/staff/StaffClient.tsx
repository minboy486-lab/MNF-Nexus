"use client";

import { formatMp } from "@/lib/utils/mp";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  staffCheckIn,
  staffCheckOut,
  recordStaffAdvance,
} from "@/lib/actions/staff";

type StaffRow = {
  id: string;
  name: string;
  role: string;
  hourly_wage: number;
};

type PayrollLine = {
  staffId: string;
  name: string;
  hours: number;
  gross: number;
  advances: number;
  net: number;
};

type Props = {
  staff: StaffRow[];
  payrollLines: PayrollLine[];
  configured: boolean;
};

export function StaffClient({ staff, payrollLines, configured }: Props) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [advanceStaff, setAdvanceStaff] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState(0);

  if (!configured) {
    return <p className="text-on-surface-variant">Supabase 연결 후 사용 가능합니다.</p>;
  }

  async function checkIn(id: string) {
    const r = await staffCheckIn(id, pin || undefined);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  async function checkOut(id: string) {
    const r = await staffCheckOut(id);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  async function handleAdvance() {
    if (!advanceStaff || advanceAmount <= 0) return;
    const r = await recordStaffAdvance(advanceStaff, advanceAmount);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="glass-panel rounded-xl p-4 flex gap-3 items-end">
        <label className="text-xs text-on-surface-variant flex-1">
          PIN (선택)
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="login-input block mt-1 w-full"
            maxLength={6}
          />
        </label>
      </div>

      <section className="space-y-3">
        {staff.map((s) => {
          const line = payrollLines.find((p) => p.staffId === s.id);
          return (
            <div key={s.id} className="glass-panel rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {s.role} · 시급 {formatMp(s.hourly_wage)}
                  {line && ` · ${line.hours}h · 실지급 ${formatMp(line.net)}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => checkIn(s.id)}
                  className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm"
                >
                  출근
                </button>
                <button
                  type="button"
                  onClick={() => checkOut(s.id)}
                  className="px-3 py-2 rounded-lg border border-white/10 text-sm"
                >
                  퇴근
                </button>
              </div>
            </div>
          );
        })}
        {staff.length === 0 && (
          <p className="text-on-surface-variant text-sm">staff 테이블에 직원을 등록하세요.</p>
        )}
      </section>

      <section className="glass-panel rounded-xl p-5">
        <h2 className="font-bold mb-3">가불 등록</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={advanceStaff}
            onChange={(e) => setAdvanceStaff(e.target.value)}
            className="login-input"
          >
            <option value="">직원</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={advanceAmount || ""}
            onChange={(e) => setAdvanceAmount(Number(e.target.value))}
            placeholder="금액"
            className="login-input w-32"
          />
          <button type="button" onClick={handleAdvance} className="btn-primary px-4 py-2 rounded-lg text-sm">
            가불 기록
          </button>
        </div>
      </section>
    </div>
  );
}
