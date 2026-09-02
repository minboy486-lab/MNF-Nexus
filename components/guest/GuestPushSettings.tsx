"use client";

import { useEffect, useState } from "react";
import { hasServerPushSubscription } from "@/lib/actions/guest-push";
import {
  disableGuestPushNotifications,
  enableGuestPushNotifications,
  forceRefreshGuestPushNotifications,
} from "@/lib/guest/enable-push";
import { isInstalledGuestPwa } from "@/lib/guest/permissions-onboarding";
import { isPushApiAvailable } from "@/lib/guest/push-environment";
import { getLocalPushEndpoint } from "@/lib/guest/push-status";
import { showPointNotification } from "@/lib/guest/push-client";
import { fetchServerVapidConfig, type ServerVapidConfig } from "@/lib/guest/fetch-vapid-public-key";
import { getCachedVapidPublicKey, preloadPushEnvironment } from "@/lib/guest/push-prefetch";

type Status = "unsupported" | "blocked" | "off" | "on" | "loading";

function serverConfigErrorMessage(config: ServerVapidConfig): string {
  if (config.fetchFailed) {
    return "서버 VAPID 설정을 불러오지 못했습니다. 인터넷 연결을 확인하고 페이지를 새로고침해 주세요.";
  }
  if (config.keysMatch === false) {
    return "Vercel의 VAPID 공개키와 비밀키가 한 쌍이 아닙니다. npm run vapid:generate 결과를 다시 넣어 주세요.";
  }
  if (!config.pushConfigured) {
    if (config.missingPublic && config.missingPrivate) {
      return "서버에 VAPID 키가 없습니다. 관리자가 npm run vapid:generate 로 생성한 공개·비밀 키 쌍을 Vercel에 넣고 재배포해야 합니다.";
    }
    if (config.missingPublic) {
      return "서버에 VAPID 공개키(NEXT_PUBLIC_VAPID_PUBLIC_KEY)가 없습니다.";
    }
    if (config.missingPrivate) {
      return "서버에 VAPID 비밀키(VAPID_PRIVATE_KEY)가 없습니다.";
    }
    return "서버 VAPID 키가 설정되지 않았습니다.";
  }
  if (!config.adminConfigured) {
    return "서버에 SUPABASE_SERVICE_ROLE_KEY가 없어 푸시를 보낼 수 없습니다.";
  }
  return "";
}

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
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerVapidConfig | null>(null);
  const [pushReady, setPushReady] = useState(false);
  const needsPwa = isIos() && !isInstalledGuestPwa();

  useEffect(() => {
    void preloadPushEnvironment().finally(() => {
      setPushReady(Boolean(getCachedVapidPublicKey()));
    });
    void Promise.all([resolveStatus(), fetchServerVapidConfig()]).then(([nextStatus, config]) => {
      setStatus(nextStatus);
      setServerConfig(config);
      const configError = serverConfigErrorMessage(config);
      setError(configError || null);
    });
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

  async function refreshSubscription() {
    setError(null);
    setSuccess(null);
    setPending(true);
    const result = await forceRefreshGuestPushNotifications();
    setPending(false);
    if ("ok" in result && result.ok) {
      setStatus("on");
      setSuccess("푸시 구독을 새로 등록했습니다.");
      return;
    }
    if ("error" in result) {
      setError(result.error);
    }
  }

  async function testServerPush() {
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const config = serverConfig ?? (await fetchServerVapidConfig());
      setServerConfig(config);
      const configError = serverConfigErrorMessage(config);
      if (configError) {
        setError(configError);
        return;
      }

      const refreshed = await forceRefreshGuestPushNotifications();
      if ("error" in refreshed) {
        setError(refreshed.error);
        setStatus("off");
        return;
      }
      setStatus("on");

      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        sent?: number;
        publicKeyHint?: string;
      };
      if (!res.ok) {
        const message =
          data.error === "no_member"
            ? "손님 정보가 없어 서버 푸시를 보낼 수 없습니다."
            : data.error === "not_configured"
              ? data.detail ?? serverConfigErrorMessage(config)
              : data.error === "no_subscriptions"
                ? "서버에 푸시 구독이 없습니다. 아래 ‘구독 새로고침’을 눌러 주세요."
                : data.error === "no_user"
                  ? "로그인 계정이 연결되지 않았습니다. 매장에 문의해 주세요."
                  : data.detail
                    ? `${data.detail}${data.publicKeyHint ? ` (서버 공개키 ${data.publicKeyHint})` : ""}`
                    : "서버 푸시 전송에 실패했습니다. Vercel의 VAPID 공개·비밀 키가 한 쌍인지 확인한 뒤 구독 새로고침을 눌러 주세요.";
        setError(message);
        if (data.error === "no_subscriptions" || data.error === "delivery_failed") {
          setStatus("off");
        }
        return;
      }
      setSuccess(
        data.sent
          ? `서버에서 푸시를 보냈습니다 (${data.sent}건). 잠시 후 알림을 확인해 주세요.`
          : "서버에서 푸시를 보냈습니다. 잠시 후 알림을 확인해 주세요.",
      );
    } catch {
      setError("서버 푸시 요청에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function testLocalNotification() {
    setError(null);
    if (Notification.permission !== "granted") {
      setError("먼저 알림을 켜 주세요.");
      return;
    }
    await showPointNotification({
      txnType: "point_earn",
      amountWon: 10000,
      note: "로컬 테스트",
      txnId: `test-local-${Date.now()}`,
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

      {serverConfig?.publicKeyHint && (
        <p className="text-xs text-on-surface-variant">
          서버 VAPID 공개키: <span className="font-mono">{serverConfig.publicKeyHint}</span>
          {" "}(Vercel 값과 같아야 합니다)
        </p>
      )}

      {serverConfig && !serverConfig.pushConfigured && serverConfig.derivedPublicKeyHint && (
        <p className="text-xs text-on-surface-variant">
          비밀키에서 계산한 공개키:{" "}
          <span className="font-mono">{serverConfig.derivedPublicKeyHint}</span>
          {" "}
          (위 공개키와 다르면 Vercel에 잘못 넣은 것입니다)
        </p>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
      {success && <p className="text-sm text-primary">{success}</p>}

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
            onClick={() => void testServerPush()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            서버 푸시 테스트 (백그라운드와 동일)
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void refreshSubscription()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-white/15 text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
          >
            구독 새로고침 (VAPID 재등록)
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void testLocalNotification()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-white/15 text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
          >
            로컬 표시 테스트
          </button>
        </div>
      ) : status !== "blocked" ? (
        <button
          type="button"
          disabled={pending || needsPwa}
          onClick={() => void enable()}
          className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {pending ? "설정 중…" : pushReady ? "알림 켜기" : "알림 켜기 (준비 중…)"}
        </button>
      ) : null}
    </section>
  );
}
