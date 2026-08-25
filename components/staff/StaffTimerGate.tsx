"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  consumeFailedLanNavigation,
  markLanNavigation,
  readTimerPairing,
  readTimerPairingRaw,
  subscribeTimerPairing,
  timerRemoteHref,
  LAN_WIFI_ERROR,
} from "@/lib/staff/timer-pairing";
import { StaffClockInClient } from "@/components/staff/StaffClockInClient";

type Props = {
  loginId: string;
};

export function StaffTimerGate({ loginId }: Props) {
  const raw = useSyncExternalStore(subscribeTimerPairing, readTimerPairingRaw, () => null);
  const pairing = raw ? readTimerPairing() : null;
  const [wifiError, setWifiError] = useState(false);

  useEffect(() => {
    function onShow() {
      if (consumeFailedLanNavigation()) setWifiError(true);
    }
    window.addEventListener("pageshow", onShow);
    if (consumeFailedLanNavigation()) {
      setWifiError(true);
      return () => window.removeEventListener("pageshow", onShow);
    }
    if (!raw || wifiError) {
      return () => window.removeEventListener("pageshow", onShow);
    }
    const next = readTimerPairing();
    if (!next) {
      return () => window.removeEventListener("pageshow", onShow);
    }
    markLanNavigation();
    window.location.replace(timerRemoteHref({ ...next, loginId: next.loginId || loginId }));
    return () => window.removeEventListener("pageshow", onShow);
  }, [raw, loginId, wifiError]);

  if (wifiError) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-3">
        <p className="text-sm text-error bg-error/10 rounded-xl px-3 py-2">{LAN_WIFI_ERROR}</p>
        <button
          type="button"
          className="w-full h-12 rounded-xl bg-primary text-on-primary text-sm font-bold"
          onClick={() => {
            setWifiError(false);
          }}
        >
          다시 연결
        </button>
      </div>
    );
  }

  if (!pairing) {
    return <StaffClockInClient loginId={loginId} />;
  }

  return (
    <p className="p-6 text-center text-on-surface-variant text-sm">컨트롤러에 연결하는 중...</p>
  );
}
