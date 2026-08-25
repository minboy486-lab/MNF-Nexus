"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  readTimerPairing,
  readTimerPairingRaw,
  subscribeTimerPairing,
  timerRemoteHref,
} from "@/lib/staff/timer-pairing";
import { StaffClockInClient } from "@/components/staff/StaffClockInClient";

type Props = {
  loginId: string;
};

export function StaffTimerGate({ loginId }: Props) {
  const raw = useSyncExternalStore(subscribeTimerPairing, readTimerPairingRaw, () => null);
  const pairing = raw ? readTimerPairing() : null;

  useEffect(() => {
    const next = readTimerPairing();
    if (!next) return;
    window.location.replace(timerRemoteHref({ ...next, loginId: next.loginId || loginId }));
  }, [raw, loginId]);

  if (!pairing) {
    return <StaffClockInClient loginId={loginId} mode="pair" />;
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-3">
      <p className="text-center text-on-surface-variant text-sm">컨트롤러에 연결하는 중...</p>
      <button
        type="button"
        className="w-full h-12 rounded-xl bg-primary text-on-primary text-sm font-bold"
        onClick={() => {
          const next = readTimerPairing();
          if (next) {
            window.location.replace(timerRemoteHref({ ...next, loginId: next.loginId || loginId }));
            return;
          }
          window.location.reload();
        }}
      >
        새로고침
      </button>
    </div>
  );
}
