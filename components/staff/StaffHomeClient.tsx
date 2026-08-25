"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { punchMeOut } from "@/lib/actions/staff";
import { StaffCheckoutConfirm } from "@/components/staff/StaffCheckoutConfirm";
import { formatTimeHHmmKST } from "@/lib/utils/format";
import {
  clearTimerPairing,
  consumeFailedLanNavigation,
  markLanNavigation,
  readTimerPairing,
  readTimerPairingRaw,
  subscribeTimerPairing,
  timerRemoteHref,
  LAN_WIFI_ERROR,
} from "@/lib/staff/timer-pairing";

type Props = {
  name: string;
  loginId: string;
  working: boolean;
  checkedInAt: string | null;
};

export function StaffHomeClient({ name, loginId, working, checkedInAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [wifiError, setWifiError] = useState(false);
  const hasPairing = useSyncExternalStore(
    subscribeTimerPairing,
    readTimerPairingRaw,
    () => null,
  ) != null;

  async function checkout() {
    if (busy) return;
    setBusy(true);
    const r = await punchMeOut();
    setBusy(false);
    setConfirmOut(false);
    if ("error" in r) alert(r.error);
    else {
      clearTimerPairing();
      router.refresh();
    }
  }

  useEffect(() => {
    if (consumeFailedLanNavigation()) setWifiError(true);
    function onShow() {
      if (consumeFailedLanNavigation()) setWifiError(true);
    }
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  function openTimer() {
    const pairing = readTimerPairing();
    if (!pairing) {
      window.location.assign("/staff/timer");
      return;
    }
    setWifiError(false);
    markLanNavigation();
    window.location.assign(timerRemoteHref({ ...pairing, loginId: pairing.loginId || loginId }));
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

      {wifiError && (
        <p className="text-sm text-error bg-error/10 rounded-xl px-3 py-2">{LAN_WIFI_ERROR}</p>
      )}

      {!working ? (
        <Link
          href="/staff/clock-in"
          className="block w-full rounded-2xl p-5 border border-primary/35 bg-primary/12 no-underline"
        >
          <span className="material-symbols-outlined text-4xl text-primary">qr_code_scanner</span>
          <p className="text-xl font-bold mt-2">출근 등록</p>
          <p className="text-sm text-on-surface-variant mt-1">매장 와이파이에서 컨트롤러 QR을 한 번 스캔하면 출근됩니다. 퇴근 전까지 다시 찍지 않아도 됩니다.</p>
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
