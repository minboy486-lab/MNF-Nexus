"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StaffQrScanner } from "@/components/staff/StaffQrScanner";
import {
  parseControllerQr,
  saveTimerPairing,
  markLanNavigation,
  timerRemoteHref,
  pairingUrlWithoutTok,
  consumeFailedLanNavigation,
  LAN_WIFI_ERROR,
} from "@/lib/staff/timer-pairing";

type Props = {
  loginId: string;
};

export function StaffClockInClient({ loginId }: Props) {
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (consumeFailedLanNavigation()) {
      busyRef.current = false;
      setBusy(false);
      setError(LAN_WIFI_ERROR);
    }
    function onShow() {
      if (consumeFailedLanNavigation()) {
        busyRef.current = false;
        setBusy(false);
        setError(LAN_WIFI_ERROR);
      }
    }
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const onDetect = useCallback(
    (text: string) => {
      if (busyRef.current) return true;
      const parsed = parseControllerQr(text);
      if (!parsed?.tok || !parsed.pin) {
        setError("컨트롤러 QR이 아닙니다. 매장 와이파이에서 타이머 왼쪽 위 로고 QR을 스캔해 주세요.");
        return false;
      }
      busyRef.current = true;
      setBusy(true);
      setError(null);
      const pairing = {
        url: parsed.url,
        pin: parsed.pin,
        tok: parsed.tok,
        loginId,
      };
      saveTimerPairing({ ...pairing, url: pairingUrlWithoutTok(parsed.url) });
      markLanNavigation();
      window.location.assign(timerRemoteHref(pairing, "clock-in"));
      return true;
    },
    [loginId],
  );

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">출근 등록</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          매장 와이파이에서 컨트롤러 로고 QR을 한 번만 스캔하세요. 퇴근 전까지는 다시 찍지 않아도 됩니다.
        </p>
      </div>
      {error && (
        <p className="text-sm text-error bg-error/10 rounded-xl px-3 py-2">{error}</p>
      )}
      {busy && (
        <p className="text-sm text-primary bg-primary/12 rounded-xl px-3 py-2 font-semibold">
          촬영됨 · 매장 컨트롤러로 연결 중입니다
        </p>
      )}
      <StaffQrScanner
        paused={busy}
        busy={busy}
        busyLabel="촬영됨 · 매장 와이파이 연결 중"
        hint="한 번 맞추면 퇴근 전까지 다시 찍지 않아도 됩니다"
        onDetect={onDetect}
      />
    </div>
  );
}
