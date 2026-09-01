"use client";

import {
  getPushPublicKey,
  hasServerPushSubscription,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/actions/guest-push";
import { isPushApiAvailable } from "@/lib/guest/push-environment";
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

async function ensureBrowserPushSubscription(
  reg: ServiceWorkerRegistration,
  vapidKey: string,
): Promise<PushSubscription> {
  const applicationServerKey = urlBase64ToUint8Array(vapidKey) as BufferSource;
  let sub = await reg.pushManager.getSubscription();

  if (sub && !subscriptionUsesVapidKey(sub, vapidKey)) {
    try {
      await sub.unsubscribe();
    } catch {
      /* stale */
    }
    sub = null;
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  return sub;
}

/** 기존 브라우저 구독만 서버에 동기화 (사용자 제스처 없이 호출 가능). */
export async function syncExistingPushSubscriptionToServer(): Promise<void> {
  if (!isPushApiAvailable() || Notification.permission !== "granted") return;

  try {
    const vapidKey = await getPushPublicKey();
    if (!vapidKey) return;

    const reg = await getServiceWorkerRegistration();
    if (!reg) return;

    const sub = await ensureBrowserPushSubscription(reg, vapidKey);
    await persistSubscription(sub);
  } catch {
    /* 동기화 실패 — 설정에서 다시 켜기 */
  }
}

/** 알림 권한 + Web Push 구독 (버튼 탭 등 사용자 동작 후 호출). */
export async function enableGuestPushNotifications(): Promise<EnablePushResult> {
  if (!isPushApiAvailable()) {
    return {
      error: "HTTPS 또는 홈 화면 앱에서만 알림을 사용할 수 있습니다.",
      unsupported: true,
    };
  }

  const vapidKey = await getPushPublicKey();
  if (!vapidKey) {
    return { error: "서버에 알림 키(VAPID)가 설정되지 않았습니다." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      error: permission === "denied" ? "알림이 차단되었습니다." : "알림 권한이 필요합니다.",
      denied: permission === "denied",
    };
  }

  const reg = await getServiceWorkerRegistration();
  if (!reg) return { error: "서비스 워커를 등록하지 못했습니다. 페이지를 새로고침해 주세요." };

  try {
    const sub = await ensureBrowserPushSubscription(reg, vapidKey);
    return persistSubscription(sub);
  } catch (err) {
    const message = err instanceof Error ? err.message : "구독에 실패했습니다.";
    return { error: message };
  }
}

/** @deprecated syncExistingPushSubscriptionToServer 사용 */
export async function ensureGuestPushSubscription(): Promise<void> {
  await syncExistingPushSubscriptionToServer();
}

export async function disableGuestPushNotifications(): Promise<{ ok: true } | { error: string }> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await removePushSubscription(endpoint);
  }
  return { ok: true };
}

export async function isWebPushFullyEnabled(): Promise<boolean> {
  if (!isPushApiAvailable() || Notification.permission !== "granted") return false;

  try {
    const reg = await getServiceWorkerRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return false;
    return hasServerPushSubscription(sub.endpoint);
  } catch {
    return false;
  }
}
