"use client";

import { useEffect, useState } from "react";
import { enableGuestPushNotifications } from "@/lib/guest/enable-push";
import { preloadPushEnvironment } from "@/lib/guest/push-prefetch";
import {
  markGuestPermissionOnboardingDone,
  shouldShowGuestPermissionOnboarding,
} from "@/lib/guest/permissions-onboarding";

export function GuestPermissionOnboarding() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void preloadPushEnvironment();
    if (shouldShowGuestPermissionOnboarding()) {
      setOpen(true);
    }
  }, []);

  function finish() {
    markGuestPermissionOnboardingDone();
    setOpen(false);
  }

  async function handleNotify() {
    setPending(true);
    setMessage(null);
    const result = await enableGuestPushNotifications();
    setPending(false);
    if ("ok" in result && result.ok) {
      setNotifyDone(true);
      finish();
      return;
    }
    if ("error" in result) {
      setMessage(result.error);
      if (result.denied) setNotifyDone(true);
      return;
    }
    finish();
  }

  if (!open) return null;

  return (
    <div
      className="guest-permission-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-permission-title"
    >
      <div className="guest-permission-modal glass-panel">
        <h2 id="guest-permission-title" className="text-lg font-bold">
          알림 안내
        </h2>
        <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
          포인트 충전·차감 시 알려드립니다. 앱을 닫아 두어도 받으려면 아래에서 허용해 주세요.
        </p>

        <ul className="guest-permission-list mt-4 space-y-3">
          <li className={`guest-permission-item ${notifyDone ? "guest-permission-item--done" : ""}`}>
            <span className="material-symbols-outlined guest-permission-item__icon">notifications</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">알림</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                포인트 충전·차감 시 알려드립니다
              </p>
            </div>
            {notifyDone && (
              <span className="material-symbols-outlined text-primary text-lg" aria-hidden>
                check_circle
              </span>
            )}
          </li>
        </ul>

        {message && <p className="text-xs text-on-surface-variant mt-3">{message}</p>}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleNotify()}
            className="btn-primary w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {pending ? "요청 중…" : "알림 허용하기"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={finish}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
