"use client";

import { useEffect, useState } from "react";
import { hasServerPushSubscription } from "@/lib/actions/guest-push";
import {
  disableGuestPushNotifications,
  enableGuestPushNotifications,
} from "@/lib/guest/enable-push";
import { hasActivePushSubscription } from "@/lib/guest/push-status";
import { showPointNotification } from "@/lib/guest/push-client";

type Status = "unsupported" | "blocked" | "off" | "on" | "loading";

async function resolveStatus(): Promise<Status> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";

  const [local, server] = await Promise.all([
    hasActivePushSubscription(),
    hasServerPushSubscription(),
  ]);
  return local && server ? "on" : "off";
}

export function GuestPushSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void resolveStatus().then(setStatus);
  }, []);

  async function enable() {
    setError(null);
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
          이 기기·브라우저에서는 알림을 지원하지 않습니다. iOS는 홈 화면에 추가한 앱에서만
          지원됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
      <div>
        <h2 className="text-base font-bold">포인트 알림</h2>
        <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
          앱을 닫아 두거나 다른 앱을 써도 포인트 변경 알림을 받습니다. 홈 화면에 추가한 앱에서
          한 번 켜 주세요.
        </p>
      </div>

      {status === "blocked" && (
        <p className="text-sm text-error">
          알림이 차단되어 있습니다. iOS 설정 → 알림 → MNF HOLDEM에서 허용해 주세요.
        </p>
      )}

      {status === "off" && Notification.permission === "granted" && (
        <p className="text-sm text-on-surface-variant">
          알림 권한은 허용됐지만 백그라운드 구독이 없습니다. 아래 버튼으로 등록해 주세요.
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
            테스트 알림 보내기
          </button>
        </div>
      ) : status !== "blocked" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void enable()}
          className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {pending ? "설정 중…" : "알림 켜기"}
        </button>
      ) : null}
    </section>
  );
}
