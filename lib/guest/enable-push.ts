"use client";

import {
  hasServerPushSubscription,
  removeAllPushSubscriptions,
  savePushSubscription,
} from "@/lib/actions/guest-push";
import { fetchServerVapidPublicKey } from "@/lib/guest/fetch-vapid-public-key";
import { isPushApiAvailable } from "@/lib/guest/push-environment";
import { getCachedVapidPublicKey } from "@/lib/guest/push-prefetch";
import { getServiceWorkerRegistration, urlBase64ToUint8Array } from "@/lib/guest/push-client";
import { subscriptionUsesVapidKey } from "@/lib/guest/push-vapid";

export type EnablePushResult =
  | { ok: true }
  | { error: string; denied?: boolean; unsupported?: boolean };

async function persistSubscription(sub: PushSubscription): Promise<EnablePushResult> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { error: "구독에 실패했습니다." };
  }

  const result = await savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });

  if ("error" in result) return { error: result.error };

  const onServer = await hasServerPushSubscription(json.endpoint);
  if (!onServer) {
    return { error: "서버에 알림 구독을 저장하지 못했습니다. 다시 시도해 주세요." };
  }

  return { ok: true };
}

function formatSubscribeError(err: unknown): string {
  const message = err instanceof Error ? err.message : "구독에 실패했습니다.";
  if (/user gesture|user activation|requires a user/i.test(message)) {
    return "알림 켜기 버튼을 다시 눌러 주세요. (페이지 로딩 후 바로 누르면 더 잘 됩니다)";
  }
  return message;
}

function subscribeFromGesture(vapidKey: string): Promise<EnablePushResult> {
  if (!("serviceWorker" in navigator)) {
    return Promise.resolve({ error: "서비스 워커를 사용할 수 없습니다." });
  }

  return navigator.serviceWorker.ready
    .then((reg) =>
      reg.pushManager.getSubscription().then((existing) => {
        if (existing && subscriptionUsesVapidKey(existing, vapidKey)) {
          return existing;
        }
        if (existing) {
          return existing.unsubscribe().then(() =>
            reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
            }),
          );
        }
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });
      }),
    )
    .then((sub) => persistSubscription(sub))
    .catch((err) => ({ error: formatSubscribeError(err) }));
}

/** 기존 브라우저 구독만 서버에 동기화 (사용자 제스처 없이 호출 가능). */
export async function syncExistingPushSubscriptionToServer(): Promise<void> {
  if (!isPushApiAvailable() || Notification.permission !== "granted") return;

  const vapidKey = getCachedVapidPublicKey() ?? (await fetchServerVapidPublicKey());
  if (!vapidKey) return;

  const reg = await getServiceWorkerRegistration();
  if (!reg) return;

  const existing = await reg.pushManager.getSubscription();
  if (!existing) return;

  if (!subscriptionUsesVapidKey(existing, vapidKey)) {
    try {
      await existing.unsubscribe();
    } catch {
      /* ignore */
    }
    await removeAllPushSubscriptions();
    return;
  }

  try {
    await persistSubscription(existing);
  } catch {
    /* 동기화 실패 — 설정에서 다시 켜기 */
  }
}

/** 알림 권한 + Web Push 구독 (버튼 탭 직후 호출). */
export function enableGuestPushNotifications(): Promise<EnablePushResult> {
  if (!isPushApiAvailable()) {
    return Promise.resolve({
      error: "HTTPS 또는 홈 화면 앱에서만 알림을 사용할 수 있습니다.",
      unsupported: true,
    });
  }

  const vapidKey = getCachedVapidPublicKey();
  if (!vapidKey) {
    return Promise.resolve({
      error: "알림 준비가 안 됐습니다. 잠시 후 다시 눌러 주세요.",
    });
  }

  if (Notification.permission === "granted") {
    return subscribeFromGesture(vapidKey);
  }

  if (Notification.permission === "denied") {
    return Promise.resolve({
      error: "알림이 차단되었습니다.",
      denied: true,
    });
  }

  return Notification.requestPermission().then((permission) => {
    if (permission !== "granted") {
      return {
        error: permission === "denied" ? "알림이 차단되었습니다." : "알림 권한이 필요합니다.",
        denied: permission === "denied",
      };
    }
    return subscribeFromGesture(vapidKey);
  });
}

/** @deprecated syncExistingPushSubscriptionToServer 사용 */
export async function ensureGuestPushSubscription(): Promise<void> {
  await syncExistingPushSubscriptionToServer();
}

export async function disableGuestPushNotifications(): Promise<{ ok: true } | { error: string }> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      try {
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
    }
  }
  await removeAllPushSubscriptions();
  return { ok: true };
}

/** 브라우저·서버 구독을 모두 지우고 VAPID로 새로 등록합니다. */
export function forceRefreshGuestPushNotifications(): Promise<EnablePushResult> {
  if (!isPushApiAvailable()) {
    return Promise.resolve({
      error: "HTTPS 또는 홈 화면 앱에서만 알림을 사용할 수 있습니다.",
      unsupported: true,
    });
  }

  if (Notification.permission !== "granted") {
    return Promise.resolve({
      error: "먼저 알림 권한을 허용해 주세요.",
      denied: Notification.permission === "denied",
    });
  }

  const vapidKey = getCachedVapidPublicKey();
  if (!vapidKey) {
    return Promise.resolve({ error: "알림 준비가 안 됐습니다. 잠시 후 다시 눌러 주세요." });
  }

  void removeAllPushSubscriptions();

  if (!("serviceWorker" in navigator)) {
    return Promise.resolve({ error: "서비스 워커를 사용할 수 없습니다." });
  }

  return navigator.serviceWorker.ready
    .then((reg) => reg.pushManager.getSubscription())
    .then((existing) => (existing ? existing.unsubscribe() : undefined))
    .then(() => subscribeFromGesture(vapidKey));
}

export async function isWebPushFullyEnabled(): Promise<boolean> {
  if (!isPushApiAvailable() || Notification.permission !== "granted") return false;

  try {
    const vapidKey = getCachedVapidPublicKey() ?? (await fetchServerVapidPublicKey());
    if (!vapidKey) return false;

    const reg = await getServiceWorkerRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub || !subscriptionUsesVapidKey(sub, vapidKey)) return false;
    return hasServerPushSubscription(sub.endpoint);
  } catch {
    return false;
  }
}
