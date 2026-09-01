"use client";

import { useEffect, useState } from "react";
import { requestStaffCameraAccess } from "@/lib/staff/staff-camera";
import {
  markStaffPermissionOnboardingDone,
  shouldShowStaffPermissionOnboarding,
} from "@/lib/staff/permissions-onboarding";
import { requestStaffNotificationAccess } from "@/lib/staff/request-notifications";

type Step = "notify" | "camera" | "done";

export function StaffPermissionOnboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("notify");
  const [pending, setPending] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);
  const [cameraDone, setCameraDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (shouldShowStaffPermissionOnboarding()) {
      setOpen(true);
    }
  }, []);

  function finish() {
    markStaffPermissionOnboardingDone();
    setOpen(false);
  }

  async function handleNotify() {
    setPending(true);
    setMessage(null);
    const result = await requestStaffNotificationAccess();
    setPending(false);
    if ("ok" in result && result.ok) {
      setNotifyDone(true);
      setStep("camera");
      return;
    }
    if ("error" in result) {
      setMessage(result.error);
      if (result.denied) setNotifyDone(true);
    }
    setStep("camera");
  }

  async function handleCamera() {
    setPending(true);
    setMessage(null);
    const result = await requestStaffCameraAccess();
    setPending(false);
    setCameraDone(result === "granted");
    if (result === "denied") {
      setMessage("카메라가 차단되었습니다. 나중에 설정에서 허용할 수 있습니다.");
    } else if (result === "unsupported") {
      setMessage("이 기기에서는 카메라를 사용할 수 없습니다.");
    }
    finish();
  }

  function handleSkip() {
    if (step === "notify") {
      setStep("camera");
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
      aria-labelledby="staff-permission-title"
    >
      <div className="guest-permission-modal glass-panel">
        <h2 id="staff-permission-title" className="text-lg font-bold">
          앱 권한 안내
        </h2>
        <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
          MNF HOLDEM 직원 앱을 편하게 쓰려면 아래 권한이 필요합니다. 버튼을 누르면 휴대폰 설정
          창이 열립니다.
        </p>

        <ul className="guest-permission-list mt-4 space-y-3">
          <li className={`guest-permission-item ${notifyDone ? "guest-permission-item--done" : ""}`}>
            <span className="material-symbols-outlined guest-permission-item__icon">notifications</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">알림</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                업무 알림·안내를 받을 수 있습니다
              </p>
            </div>
            {notifyDone && (
              <span className="material-symbols-outlined text-primary text-lg" aria-hidden>
                check_circle
              </span>
            )}
          </li>
          <li className={`guest-permission-item ${cameraDone ? "guest-permission-item--done" : ""}`}>
            <span className="material-symbols-outlined guest-permission-item__icon">photo_camera</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">카메라</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                QR 출퇴근·매장 업무 시 사용합니다
              </p>
            </div>
            {cameraDone && (
              <span className="material-symbols-outlined text-primary text-lg" aria-hidden>
                check_circle
              </span>
            )}
          </li>
        </ul>

        {message && <p className="text-xs text-on-surface-variant mt-3">{message}</p>}

        <div className="mt-5 flex flex-col gap-2">
          {step === "notify" ? (
            <>
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
                onClick={handleSkip}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface"
              >
                나중에
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => void handleCamera()}
                className="btn-primary w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {pending ? "요청 중…" : "카메라 허용하기"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleSkip}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface"
              >
                {cameraDone || notifyDone ? "시작하기" : "건너뛰기"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
