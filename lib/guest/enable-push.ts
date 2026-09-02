"use client";

import {
  hasServerPushSubscription,
  removeAllPushSubscriptions,
  savePushSubscription,
} from "@/lib/actions/guest-push";
import { fetchServerVapidPublicKey } from "@/lib/guest/fetch-vapid-public-key";
import { isPushApiAvailable } from "@/lib/guest/push-environment";
import {
  getServiceWorkerRegistration,
  unregisterAllServiceWorkers,
  urlBase64ToUint8Array,
} from "@/lib/guest/push-client";
import { subscriptionUsesVapidKey } from "@/lib/guest/push-vapid";

export type EnablePushResult =
  | { ok: true }
  | { error: string; denied?: boolean; unsupported?: boolean };

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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

async function clearBrowserPushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

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

  await delay(400);

  for (const reg of registrations) {
    if (await reg.pushManager.getSubscription()) {
      try {
        await (await reg.pushManager.getSubscription())?.unsubscribe();
      } catch {
        /* ignore */
      }
    }
  }

  await delay(400);
}

async function subscribeFresh(
  reg: ServiceWorkerRegistration,
  vapidKey: string,
): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
    } catch {
      /* ignore */
    }
    await delay(400);
  }

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });
}

async function subscribeWithVapidKey(
  reg: ServiceWorkerRegistration,
  vapidKey: string,
): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription();
  if (existing && subscriptionUsesVapidKey(existing, vapidKey)) {
    return existing;
  }
  return subscribeFresh(reg, vapidKey);
}

function formatSubscribeError(err: unknown): string {
  const message = err instanceof Error ? err.message : "구독에 실패했습니다.";
  if (/user gesture|user activation|requires a user/i.test(message)) {
    return "알림 켜기 또는 구독 새로고침 버튼을 눌러 주세요.";
  }
  return message;
}

/** 기존 브라우저 구독만 서버에 동기화 (사용자 제스처 없이 호출 가능). */
export async function syncExistingPushSubscriptionToServer(): Promise<void> {
  if (!isPushApiAvailable() || Notification.permission !== "granted") return;

  const vapidKey = await fetchServerVapidPublicKey();
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

/** 알림 권한 + Web Push 구독 (버튼 탭 등 사용자 동작 후 호출). */
export async function enableGuestPushNotifications(): Promise<EnablePushResult> {
  if (!isPushApiAvailable()) {
    return {
      error: "HTTPS 또는 홈 화면 앱에서만 알림을 사용할 수 있습니다.",
      unsupported: true,
    };
  }

  const vapidKey = await fetchServerVapidPublicKey();
  if (!vapidKey) {
    return {
      error:
        "서버 VAPID 공개키를 불러오지 못했습니다. Vercel에 키를 넣고 재배포했는지 확인해 주세요.",
    };
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
    const sub = await subscribeWithVapidKey(reg, vapidKey);
    return persistSubscription(sub);
  } catch (err) {
    return { error: formatSubscribeError(err) };
  }
}

/** @deprecated syncExistingPushSubscriptionToServer 사용 */
export async function ensureGuestPushSubscription(): Promise<void> {
  await syncExistingPushSubscriptionToServer();
}

export async function disableGuestPushNotifications(): Promise<{ ok: true } | { error: string }> {
  await clearBrowserPushSubscription();
  await removeAllPushSubscriptions();
  return { ok: true };
}

/** 브라우저·서버 구독을 모두 지우고 VAPID로 새로 등록합니다. */
export async function forceRefreshGuestPushNotifications(): Promise<EnablePushResult> {
  if (!isPushApiAvailable()) {
    return {
      error: "HTTPS 또는 홈 화면 앱에서만 알림을 사용할 수 있습니다.",
      unsupported: true,
    };
  }

  if (Notification.permission !== "granted") {
    return { error: "먼저 알림 권한을 허용해 주세요.", denied: Notification.permission === "denied" };
  }

  const vapidKey = await fetchServerVapidPublicKey();
  if (!vapidKey) {
    return {
      error:
        "서버 VAPID 공개키를 불러오지 못했습니다. Vercel에 키를 넣고 재배포했는지 확인해 주세요.",
    };
  }

  await clearBrowserPushSubscription();
  await removeAllPushSubscriptions();
  await unregisterAllServiceWorkers();
  await delay(500);

  const reg = await getServiceWorkerRegistration();
  if (!reg) return { error: "서비스 워커를 등록하지 못했습니다. 페이지를 새로고침해 주세요." };

  try {
    const sub = await subscribeFresh(reg, vapidKey);
    const saved = await persistSubscription(sub);
    if ("ok" in saved && saved.ok && !subscriptionUsesVapidKey(sub, vapidKey)) {
      return { error: "새 VAPID 키로 구독하지 못했습니다. 사이트 데이터를 삭제한 뒤 다시 시도해 주세요." };
    }
    return saved;
  } catch (err) {
    return { error: formatSubscribeError(err) };
  }
}

export async function isWebPushFullyEnabled(): Promise<boolean> {
  if (!isPushApiAvailable() || Notification.permission !== "granted") return false;

  try {
    const vapidKey = await fetchServerVapidPublicKey();
    if (!vapidKey) return false;

    const reg = await getServiceWorkerRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub || !subscriptionUsesVapidKey(sub, vapidKey)) return false;
    return hasServerPushSubscription(sub.endpoint);
  } catch {
    return false;
  }
}
