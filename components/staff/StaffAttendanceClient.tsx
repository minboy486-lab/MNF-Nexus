"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { punchMeOut, type MyShiftRow } from "@/lib/actions/staff";
import { StaffCheckoutConfirm } from "@/components/staff/StaffCheckoutConfirm";
import { formatDateTimeKST, formatTimeHHmmKST } from "@/lib/utils/format";

type Props = {
  name: string;
  working: boolean;
  monthLabel: string;
  monthHours: number;
  shifts: MyShiftRow[];
};

function formatDay(iso: string): string {
  return formatDateTimeKST(iso).slice(0, 10).replaceAll("-", ".");
}

export function StaffAttendanceClient({
  name,
  working,
  monthLabel,
  monthHours,
  shifts,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  async function checkout() {
    if (busy) return;
    setBusy(true);
    const r = await punchMeOut();
    setBusy(false);
    setConfirmOut(false);
    if ("error" in r) alert(r.error);
    else router.refresh();
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold">근무 기록</h1>
        <p className="text-sm text-on-surface-variant mt-1">{name}</p>
      </div>

      <section className="glass-panel rounded-2xl p-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-on-surface-variant">{monthLabel} 근무</p>
          <p className="text-2xl font-bold mt-1">
            {monthHours}
            <span className="text-sm font-semibold text-on-surface-variant ml-1">시간</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">상태</p>
          <p className={`text-lg font-bold mt-1 ${working ? "text-primary" : ""}`}>
            {working ? "근무 중" : "퇴근"}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-on-surface-variant">출퇴근</h2>
        {shifts.length === 0 && (
          <p className="text-sm text-on-surface-variant">이번 달 기록이 없습니다.</p>
        )}
        {shifts.map((s) => (
          <div key={s.id} className="glass-panel rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{formatDay(s.checkedInAt)}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {formatTimeHHmmKST(s.checkedInAt)}
                {" → "}
                {s.checkedOutAt ? formatTimeHHmmKST(s.checkedOutAt) : "근무 중"}
              </p>
            </div>
            <p className="text-sm font-bold tabular-nums">{s.hours.toFixed(1)}h</p>
          </div>
        ))}
      </section>

      {working && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmOut(true)}
          className="w-full h-12 rounded-xl bg-red-600 text-white text-sm font-bold active:scale-[0.97] active:bg-red-700 transition-transform disabled:opacity-50"
        >
          {busy ? "처리 중..." : "퇴근"}
        </button>
      )}

      {confirmOut && (
        <StaffCheckoutConfirm
          pending={busy}
          onYes={() => void checkout()}
          onNo={() => {
            if (!busy) setConfirmOut(false);
          }}
        />
      )}
    </div>
  );
}
