"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { punchMeIn } from "@/lib/actions/staff";
import { StaffQrScanner } from "@/components/staff/StaffQrScanner";
import {
  parseControllerQr,
  saveTimerPairing,
  markClockInGoHome,
  hasClockInGoHome,
  timerRemoteHref,
  pairingUrlWithoutTok,
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
        <p className="text-sm text-on-surface-variant mt-1">컨트롤러 QR을 스캔하세요</p>
      </div>
      {error && (
        <p className="text-sm text-error bg-error/10 rounded-xl px-3 py-2">{error}</p>
      )}
      {busy && (
        <p className="text-sm text-primary bg-primary/12 rounded-xl px-3 py-2 font-semibold">
          {pairingOnly ? "연결 중" : "출근 등록 중"}
        </p>
      )}
      <StaffQrScanner
        paused={busy}
        busy={busy}
        busyLabel={pairingOnly ? "연결 중" : "출근 등록 중"}
        hint="QR을 네모 안에"
        onDetect={onDetect}
      />
    </div>
  );
}
