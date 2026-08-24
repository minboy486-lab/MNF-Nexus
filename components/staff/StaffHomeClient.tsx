"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { formatTimeHHmmKST } from "@/lib/utils/format";
import {
  clearTimerPairing,
  readTimerPairing,
  readTimerPairingRaw,
  subscribeTimerPairing,
  timerRemoteHref,
} from "@/lib/staff/timer-pairing";

type Props = {
  name: string;
  loginId: string;
  working: boolean;
  checkedInAt: string | null;
};

export function StaffHomeClient({ name, loginId, working, checkedInAt }: Props) {
  const hasPairing = useSyncExternalStore(
    subscribeTimerPairing,
    readTimerPairingRaw,
    () => null,
  ) != null;

  function openTimer() {
    const pairing = readTimerPairing();
    if (pairing) {
      window.location.assign(timerRemoteHref({ ...pairing, loginId: pairing.loginId || loginId }));
      return;
    }
    window.location.assign("/staff/timer");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <section>
        <p className="text-sm text-on-surface-variant">안녕하세요</p>
        <p className="text-2xl font-bold mt-0.5">{name}</p>
        {working ? (
          <p className="text-sm text-primary mt-1">
            근무 중{checkedInAt ? ` · ${formatTimeHHmmKST(checkedInAt)} 출근` : ""}
          </p>
        ) : (
          <p className="text-sm text-on-surface-variant mt-1">아직 출근 전입니다</p>
        )}
      </section>

      {!working ? (
        <Link
          href="/staff/clock-in"
          className="block w-full rounded-2xl p-5 border border-primary/35 bg-primary/12 no-underline"
        >
          <span className="material-symbols-outlined text-4xl text-primary">qr_code_scanner</span>
          <p className="text-xl font-bold mt-2">출근 등록</p>
          <p className="text-sm text-on-surface-variant mt-1">컨트롤러 QR을 스캔하면 출근 처리됩니다</p>
        </Link>
      ) : (
        <button
          type="button"
          onClick={openTimer}
          className="block w-full text-left rounded-2xl p-5 border border-primary/35 bg-primary/12"
        >
          <span className="material-symbols-outlined text-4xl text-primary">timer</span>
          <p className="text-xl font-bold mt-2">타이머 관리</p>
          <p className="text-sm text-on-surface-variant mt-1">
            {hasPairing ? "진행 중 게임을 조작합니다" : "컨트롤러 QR을 한 번 더 스캔해 연결합니다"}
          </p>
        </button>
      )}
      {working && hasPairing && (
        <button
          type="button"
          onClick={() => {
            clearTimerPairing();
            window.location.assign("/staff/timer");
          }}
          className="w-full text-center text-xs text-on-surface-variant"
        >
          컨트롤러 QR 다시 스캔
        </button>
      )}

      <p className="text-[11px] text-on-surface-variant/80 px-1">직원 메뉴</p>
      <Link
        href="/staff/attendance"
        className="block w-full rounded-2xl p-5 glass-panel border border-white/10 no-underline"
      >
        <span className="material-symbols-outlined text-3xl">history</span>
        <p className="text-lg font-bold mt-1">근무 기록</p>
        <p className="text-sm text-on-surface-variant mt-1">이번 달 근무시간과 출퇴근 시각</p>
      </Link>
    </div>
  );
}
