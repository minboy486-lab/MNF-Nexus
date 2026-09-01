"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { punchMeIn } from "@/lib/actions/staff";
import { StaffQrScanner } from "@/components/staff/StaffQrScanner";
import {
  parseControllerQr,
  saveTimerPairing,
  markClockInGoHome,
  hasClockInGoHome,
  pairingUrlWithoutTok,
} from "@/lib/staff/timer-pairing";

type Props = {
  loginId: string;
};

export function StaffClockInClient({ loginId }: Props) {
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hasClockInGoHome()) {
      window.location.replace("/staff");
      return;
    }
    function onShow() {
      if (hasClockInGoHome()) window.location.replace("/staff");
    }
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const onDetect = useCallback(
    (text: string) => {
      if (busyRef.current) return true;
      const parsed = parseControllerQr(text);
      if (!parsed?.pin) {
        setError("컨트롤러 QR이 아닙니다");
        return false;
      }
      busyRef.current = true;
      setBusy(true);
      setError(null);
      saveTimerPairing({
        url: pairingUrlWithoutTok(parsed.url),
        pin: parsed.pin,
        tok: parsed.tok,
        loginId,
        urls: parsed.urls,
      });
      markClockInGoHome();
      void punchMeIn().then((result) => {
        if ("error" in result) {
          busyRef.current = false;
          setBusy(false);
          setError(result.error);
          return;
        }
        window.location.replace("/staff");
      });
      return true;
    },
    [loginId],
  );

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">출근 등록</h1>
        <p className="text-sm text-on-surface-variant mt-1">컨트롤러 QR을 한 번 스캔하세요</p>
      </div>
      {error && (
        <p className="text-sm text-error bg-error/10 rounded-xl px-3 py-2">{error}</p>
      )}
      {busy && (
        <p className="text-sm text-primary bg-primary/12 rounded-xl px-3 py-2 font-semibold">
          출근 등록 중
        </p>
      )}
      <StaffQrScanner
        paused={busy}
        busy={busy}
        busyLabel="출근 등록 중"
        hint="QR을 네모 안에"
        onDetect={onDetect}
      />
    </div>
  );
}
