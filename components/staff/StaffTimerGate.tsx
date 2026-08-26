"use client";

import { useEffect } from "react";
import { readTimerPairing, timerRemoteHref } from "@/lib/staff/timer-pairing";

type Props = {
  loginId: string;
};

/** 홈에서 바로 열리지 못한 경우만. QR 없이 저장된 컨트롤러로 연결하거나 홈으로. */
export function StaffTimerGate({ loginId }: Props) {
  useEffect(() => {
    const next = readTimerPairing();
    if (next) {
      window.location.replace(timerRemoteHref({ ...next, loginId: next.loginId || loginId }));
      return;
    }
    window.location.replace("/staff");
  }, [loginId]);

  return <p className="p-6 text-center text-on-surface-variant text-sm">연결 중...</p>;
}
