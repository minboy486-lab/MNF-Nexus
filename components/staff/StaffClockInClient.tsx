"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { punchMeIn } from "@/lib/actions/staff";
import { StaffQrScanner } from "@/components/staff/StaffQrScanner";
import {
  parseControllerQr,
  saveTimerPairing,
  timerRemoteHref,
} from "@/lib/staff/timer-pairing";

type Props = {
  loginId: string;
  nextHref?: "home" | "timer";
};

export function StaffClockInClient({ loginId, nextHref = "home" }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onResult = useCallback(
    async (text: string) => {
      if (busy) return;
      const parsed = parseControllerQr(text);
      if (!parsed?.tok || !parsed.pin) {
        setError("컨트롤러 QR이 아닙니다. 타이머 왼쪽 위 로고 QR을 스캔해 주세요.");
        return;
      }
      setBusy(true);
      setError(null);
      const pairing = { url: parsed.url, pin: parsed.pin, tok: parsed.tok, loginId };
      saveTimerPairing(pairing);
      const r = await punchMeIn();
      if ("error" in r) {
        setBusy(false);
        setError(r.error);
        return;
      }
      if (nextHref === "timer") {
        window.location.assign(timerRemoteHref(pairing));
        return;
      }
      router.replace("/staff");
      router.refresh();
    },
    [busy, loginId, nextHref, router],
  );

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">출근 등록</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          컨트롤러 화면 왼쪽 위 MNF 로고를 눌러 QR을 띄운 뒤 스캔하세요.
        </p>
      </div>
      {error && (
        <p className="text-sm text-error bg-error/10 rounded-xl px-3 py-2">{error}</p>
      )}
      <StaffQrScanner
        paused={busy}
        hint="QR이 가운데 오도록 맞춰 주세요"
        onResult={(t) => void onResult(t)}
      />
    </div>
  );
}
