"use client";

import { useEffect, useState } from "react";
import { hasServerPushSubscription } from "@/lib/actions/guest-push";
import {
  disableGuestPushNotifications,
  enableGuestPushNotifications,
} from "@/lib/guest/enable-push";
import { isInstalledGuestPwa } from "@/lib/guest/permissions-onboarding";
import { isPushApiAvailable } from "@/lib/guest/push-environment";
import { getLocalPushEndpoint } from "@/lib/guest/push-status";
import { showPointNotification } from "@/lib/guest/push-client";

type Status = "unsupported" | "blocked" | "off" | "on" | "loading";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

async function resolveStatus(): Promise<Status> {
  if (!isPushApiAvailable()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";

  const endpoint = await getLocalPushEndpoint();
  if (!endpoint) return "off";

  const server = await hasServerPushSubscription(endpoint);
  return server ? "on" : "off";
}

export function GuestPushSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const needsPwa = isIos() && !isInstalledGuestPwa();

  useEffect(() => {
    void resolveStatus().then(setStatus);
  }, []);

  async function enable() {
    setError(null);
    if (needsPwa) {
      setError("iOS에서는 Safari 공유 → 홈 화면에 추가한 뒤, 그 앱에서 알림을 켜 주세요.");
      return;
    }
    setPending(true);
    const result = await enableGuestPushNotifications();
    setPending(false);
    if ("ok" in result && result.ok) {
      setStatus("on");
      return;
    }
    if ("error" in result) {
      setError(result.error);
      if (result.denied) setStatus("blocked");
    }
  }

  async function disable() {
    setError(null);
    setPending(true);
    try {
      await disableGuestPushNotifications();
      setStatus("off");
    } catch {
      setError("알림 해제에 실패했습니다.");
    }
    setPending(false);
  }

  async function testNotification() {
    setError(null);
    if (Notification.permission !== "granted") {
      setError("먼저 알림을 켜 주세요.");
      return;
    }
    await showPointNotification({
      txnType: "point_earn",
      amountWon: 10000,
      note: "테스트",
      txnId: `test-${Date.now()}`,
    });
  }

  if (status === "loading") {
    return (
      <section className="glass-panel rounded-2xl p-5 border border-white/10">
        <p className="text-sm text-on-surface-variant">알림 설정 확인 중…</p>
      </section>
    );
  }

  if (status === "unsupported") {
    return (
      <section className="glass-panel rounded-2xl p-5 border border-white/10">
        <h2 className="text-base font-bold">포인트 알림</h2>
        <p className="text-sm text-on-surface-variant mt-2">
          이 기기·브라우저에서는 알림을 지원하지 않습니다. HTTPS 접속 또는 홈 화면 앱이
          필요합니다.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
      <div>
        <h2 className="text-base font-bold">포인트 알림</h2>
        <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
          포인트 충전·차감 시 알림을 받습니다. 앱을 닫아 두어도 받으려면 아래에서 한 번 켜
          주세요.
        </p>
      </div>

      {needsPwa && (
        <p className="text-sm text-amber-300/90 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2.5">
          iOS: Safari에서 이 사이트를 열고 <strong>공유 → 홈 화면에 추가</strong>한 뒤, 추가된
          앱에서 알림을 켜 주세요.
        </p>
      )}

      {status === "blocked" && (
        <p className="text-sm text-error">
          알림이 차단되어 있습니다. iOS 설정 → 알림 → MNF HOLDEM에서 허용해 주세요.
        </p>
      )}

      {status === "off" && Notification.permission === "granted" && (
        <p className="text-sm text-on-surface-variant">
          알림 권한은 허용됐지만 푸시 구독이 서버에 없습니다. 아래 버튼으로 다시 등록해 주세요.
        </p>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      {status === "on" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-primary font-semibold">알림 켜짐 (백그라운드 포함)</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => void disable()}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/15 text-on-surface-variant hover:border-error/30 hover:text-error transition-colors disabled:opacity-50"
            >
              끄기
            </button>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => void testNotification()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-white/15 text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
          >
            테스트 알림 (이 기기 표시 확인)
          </button>
        </div>
      ) : status !== "blocked" ? (
        <button
          type="button"
          disabled={pending || needsPwa}
          onClick={() => void enable()}
          className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {pending ? "설정 중…" : "알림 켜기"}
        </button>
      ) : null}
    </section>
  );
}
