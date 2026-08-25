"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { punchMeIn } from "@/lib/actions/staff";
import { StaffQrScanner } from "@/components/staff/StaffQrScanner";
import {
  parseControllerQr,
  saveTimerPairing,
  markLanNavigation,
  markClockInGoHome,
  hasClockInGoHome,
  timerRemoteHref,
  pairingUrlWithoutTok,
  consumeFailedLanNavigation,
  LAN_WIFI_ERROR,
} from "@/lib/staff/timer-pairing";

type Props = {
  loginId: string;
  /** clock-in: QR로 출근만 하고 홈으로. pair: 이미 출근된 폰을 컨트롤러에 연결 */
  mode?: "clock-in" | "pair";
};

export function StaffClockInClient({ loginId, mode = "clock-in" }: Props) {
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pairingOnly = mode === "pair";

  useEffect(() => {
    if (hasClockInGoHome()) {
      window.location.replace("/staff");
      return;
    }
    if (consumeFailedLanNavigation()) {
      busyRef.current = false;
      setBusy(false);
      setError(LAN_WIFI_ERROR);
    }
    function onShow() {
      if (hasClockInGoHome()) {
        window.location.replace("/staff");
        return;
      }
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
      if (!parsed?.pin) {
        setError("컨트롤러 QR이 아닙니다. 매장 와이파이에서 타이머 왼쪽 위 로고 QR을 스캔해 주세요.");
        return false;
      }
      if (!pairingOnly && !parsed.tok) {
        setError("QR이 만료되었습니다. 컨트롤러 로고를 다시 눌러 주세요.");
        return false;
      }
      busyRef.current = true;
      setBusy(true);
      setError(null);
      const pairing = {
        url: pairingUrlWithoutTok(parsed.url),
        pin: parsed.pin,
        tok: parsed.tok,
        loginId,
      };
      saveTimerPairing(pairing);

      if (pairingOnly) {
        markLanNavigation();
        window.location.replace(timerRemoteHref({ ...pairing, loginId }, "resume"));
        return true;
      }

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
    [loginId, pairingOnly],
  );

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">{pairingOnly ? "컨트롤러 연결" : "출근 등록"}</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {pairingOnly
            ? "매장 와이파이에서 컨트롤러 로고 QR을 스캔하면 리모컨이 열립니다."
            : "매장 와이파이에서 컨트롤러 로고 QR을 한 번 스캔하면 출근됩니다. 출근 후 홈에서 매장 컨트롤을 누르면 리모컨이 열립니다."}
        </p>
      </div>
      {error && (
        <p className="text-sm text-error bg-error/10 rounded-xl px-3 py-2">{error}</p>
      )}
      {busy && (
        <p className="text-sm text-primary bg-primary/12 rounded-xl px-3 py-2 font-semibold">
          {pairingOnly ? "촬영됨 · 매장 컨트롤러로 연결 중입니다" : "촬영됨 · 출근 등록 중입니다"}
        </p>
      )}
      <StaffQrScanner
        paused={busy}
        busy={busy}
        busyLabel={pairingOnly ? "촬영됨 · 매장 와이파이 연결 중" : "촬영됨 · 출근 등록 중"}
        hint={pairingOnly ? "이 폰을 매장 컨트롤러에 연결합니다" : "한 번 출근하면 퇴근 전까지 다시 찍지 않아도 됩니다"}
        onDetect={onDetect}
      />
    </div>
  );
}
