"use client";

import { useEffect, useState } from "react";
import {
  getPushPublicKey,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/actions/guest-push";
import { registerServiceWorker, urlBase64ToUint8Array } from "@/lib/guest/push-client";

type Status = "unsupported" | "blocked" | "off" | "on" | "loading";

export function GuestPushSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("blocked");
      return;
    }
    setStatus(Notification.permission === "granted" ? "on" : "off");
  }, []);

  async function enable() {
    setError(null);
    setPending(true);
    try {
      const vapidKey = await getPushPublicKey();
      if (!vapidKey) {
        setError("서버에 알림 키가 설정되지 않았습니다.");
        setPending(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        setPending(false);
        return;
      }

      const reg = await registerServiceWorker();
      if (!reg) {
        setError("알림을 사용할 수 없는 환경입니다.");
        setPending(false);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setError("구독에 실패했습니다.");
        setPending(false);
        return;
      }

      const result = await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });

      if ("error" in result) {
        setError(result.error);
        setPending(false);
        return;
      }

      setStatus("on");
    } catch {
      setError("알림 설정에 실패했습니다.");
    }
    setPending(false);
  }

  async function disable() {
    setError(null);
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await removePushSubscription(endpoint);
      }
      setStatus("off");
    } catch {
      setError("알림 해제에 실패했습니다.");
    }
    setPending(false);
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
          이 기기·브라우저에서는 알림을 지원하지 않습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
      <div>
        <h2 className="text-base font-bold">포인트 알림</h2>
        <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
          매장에서 포인트가 추가·차감되면 휴대폰 알림을 받습니다. 홈 화면에 추가한 앱에서도
          동작합니다.
        </p>
      </div>

      {status === "blocked" && (
        <p className="text-sm text-error">
          알림이 차단되어 있습니다. 브라우저 또는 기기 설정에서 MNF HOLDEM 알림을 허용해 주세요.
        </p>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      {status === "on" ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-primary font-semibold">알림 켜짐</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => void disable()}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/15 text-on-surface-variant hover:border-error/30 hover:text-error transition-colors disabled:opacity-50"
          >
            끄기
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
