"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStaffControllerLan } from "@/lib/actions/staff";
import {
  isLikelyCellularConnection,
  readTimerPairing,
  resolveControllerConnectUrls,
  saveTimerPairing,
} from "@/lib/staff/timer-pairing";

type Props = {
  loginId: string;
  /** true면 준비되면 바로 연결 시도 */
  autoConnect?: boolean;
};

export function StaffTimerConnect({ loginId, autoConnect = true }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hint, setHint] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [cellular, setCellular] = useState(false);
  const [stalePc, setStalePc] = useState(false);

  useEffect(() => {
    const pairing = readTimerPairing();
    if (!pairing) {
      window.location.replace("/staff");
      return;
    }

    setCellular(isLikelyCellularConnection());

    void getStaffControllerLan().then((cloud) => {
      const mergedPin = cloud?.fresh && cloud.pin ? cloud.pin : pairing.pin;
      const nextPairing = { ...pairing, pin: mergedPin, loginId: pairing.loginId || loginId };
      if (cloud?.fresh && cloud.ips.length) {
        saveTimerPairing({
          ...nextPairing,
          url: `http://${cloud.ips[0]}:${cloud.port}/remote/`,
          urls: cloud.ips,
        });
      }
      const urls = resolveControllerConnectUrls(nextPairing, cloud);
      if (!urls.length) {
        setStatus("error");
        setHint("저장된 컨트롤러 주소가 없습니다. QR을 다시 스캔해 주세요.");
        return;
      }
      setStalePc(cloud != null && !cloud.fresh);
      setTarget(urls[0] ?? null);
      setStatus("ready");
      if (autoConnect && !isLikelyCellularConnection() && urls[0]) {
        window.location.replace(urls[0]);
      }
    });
  }, [autoConnect, loginId]);

  function connect() {
    if (!target) return;
    window.location.assign(target);
  }

  if (status === "loading") {
    return <p className="p-6 text-center text-on-surface-variant text-sm">매장 컨트롤러 연결 중…</p>;
  }

  if (status === "error") {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <p className="text-sm text-error bg-error/10 rounded-xl px-3 py-2">{hint}</p>
        <Link href="/staff/clock-in" className="block text-center rounded-2xl p-4 border border-primary/35 bg-primary/12 no-underline">
          QR 다시 스캔
        </Link>
        <Link href="/staff" className="block text-center text-sm text-on-surface-variant no-underline">
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">매장 컨트롤 연결</h1>
        <p className="text-sm text-on-surface-variant mt-1">매장 PC와 같은 Wi-Fi에 연결되어 있어야 합니다.</p>
      </div>

      {cellular && (
        <p className="text-sm text-error bg-error/10 rounded-xl px-3 py-2">
          LTE/5G만 켜져 있으면 매장 PC에 연결할 수 없습니다. Wi-Fi를 켜고 매장 네트워크에 접속한 뒤 다시 시도해 주세요.
        </p>
      )}

      {stalePc && (
        <p className="text-sm text-on-surface-variant bg-white/5 rounded-xl px-3 py-2">
          매장 PC가 꺼져 있거나 네트워크가 바뀌었을 수 있습니다. 연결이 안 되면 QR을 다시 스캔해 주세요.
        </p>
      )}

      <button
        type="button"
        onClick={connect}
        className="block w-full rounded-2xl p-5 border border-primary/35 bg-primary/12 text-left"
      >
        <span className="material-symbols-outlined text-4xl text-primary">timer</span>
        <p className="text-xl font-bold mt-2">연결하기</p>
        <p className="text-sm text-on-surface-variant mt-1 break-all">{target}</p>
      </button>

      <Link href="/staff/clock-in" className="block text-center rounded-2xl p-4 border border-white/10 no-underline">
        QR 다시 스캔
      </Link>
      <Link href="/staff" className="block text-center text-sm text-on-surface-variant no-underline">
        홈으로
      </Link>
    </div>
  );
}
