"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  readTimerPairingRaw,
  subscribeTimerPairing,
  timerRemoteHref,
  type StaffTimerPairing,
} from "@/lib/staff/timer-pairing";
import { StaffClockInClient } from "@/components/staff/StaffClockInClient";

type Props = {
  loginId: string;
};

export function StaffTimerGate({ loginId }: Props) {
  const raw = useSyncExternalStore(subscribeTimerPairing, readTimerPairingRaw, () => null);
  let pairing: StaffTimerPairing | null = null;
  if (raw) {
    try {
      const v = JSON.parse(raw) as StaffTimerPairing;
      if (v?.url) pairing = v;
    } catch {
      pairing = null;
    }
  }

  useEffect(() => {
    if (!raw) return;
    let next: StaffTimerPairing | null = null;
    try {
      const v = JSON.parse(raw) as StaffTimerPairing;
      if (v?.url) next = v;
    } catch {
      return;
    }
    if (!next) return;
    window.location.replace(timerRemoteHref({ ...next, loginId: next.loginId || loginId }));
  }, [raw, loginId]);

  if (!pairing) {
    return <StaffClockInClient loginId={loginId} nextHref="timer" />;
  }

  return (
    <p className="p-6 text-center text-on-surface-variant text-sm">컨트롤러에 연결하는 중...</p>
  );
}
