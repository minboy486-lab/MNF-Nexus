"use client";

import { useRouter } from "next/navigation";
import { punchMeOut, type MyShiftRow } from "@/lib/actions/staff";
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

  async function checkout() {
    const r = await punchMeOut();
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

      {working && (
        <button
          type="button"
          onClick={() => void checkout()}
          className="w-full h-12 rounded-xl border border-white/15 text-sm font-semibold"
        >
          퇴근하기
        </button>
      )}

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
    </div>
  );
}
