"use client";

import {
  hasServerPushSubscription,
  removeAllPushSubscriptions,
  savePushSubscription,
} from "@/lib/actions/guest-push";
import { fetchServerVapidPublicKey } from "@/lib/guest/fetch-vapid-public-key";
import { isPushApiAvailable } from "@/lib/guest/push-environment";
import { ensureVapidPublicKey, getCachedVapidPublicKey } from "@/lib/guest/push-prefetch";
import { getServiceWorkerRegistration, urlBase64ToUint8Array } from "@/lib/guest/push-client";
import { subscriptionUsesVapidKey } from "@/lib/guest/push-vapid";
import { unsubscribeAllPushLocally } from "@/lib/guest/push-unsubscribe";

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
  if (/service worker/i.test(message)) {
    return "서비스 워커가 준비되지 않았습니다. 페이지를 새로고침한 뒤 ‘알림 켜기’를 다시 눌러 주세요.";
  }
  return message;
}

async function subscribeFromGesture(
  vapidKey: string,
  options?: { forceNew?: boolean },
): Promise<EnablePushResult> {
  if (!("serviceWorker" in navigator)) {
    return { error: "서비스 워커를 사용할 수 없습니다." };
  }

  try {
    const reg = await getServiceWorkerRegistration();
    if (!reg) {
      return {
        error: "서비스 워커를 등록하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      };
    }

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      const canReuse = !options?.forceNew && subscriptionUsesVapidKey(existing, vapidKey);
      if (!canReuse) {
        try {
          await existing.unsubscribe();
        } catch {
          /* ignore */
        }

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const still = await reg.pushManager.getSubscription();
          if (!still) break;
          try {
            await still.unsubscribe();
          } catch {
            /* ignore */
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } else {
        return persistSubscription(existing);
      }
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
    return persistSubscription(sub);
  } catch (err) {
    return { error: formatSubscribeError(err) };
  }
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

  if (!existing.options?.applicationServerKey || !subscriptionUsesVapidKey(existing, vapidKey)) {
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

  if (Notification.permission === "denied") {
    return Promise.resolve({
      error: "알림이 차단되었습니다.",
      denied: true,
    });
  }

  const subscribeWithKey = (vapidKey: string) =>
    subscribeFromGesture(vapidKey, { forceNew: true });

  const loadKeyAndSubscribe = () =>
    Promise.all([ensureVapidPublicKey(), getServiceWorkerRegistration()]).then(([vapidKey]) => {
      if (!vapidKey) {
        return {
          error:
            "서버 VAPID 키를 불러오지 못했습니다. 인터넷 연결을 확인하고 페이지를 새로고침해 주세요.",
        };
      }
      return subscribeWithKey(vapidKey);
    });

  if (Notification.permission === "granted") {
    const cached = getCachedVapidPublicKey();
    if (cached) {
      return getServiceWorkerRegistration().then(() => subscribeWithKey(cached));
    }
    return loadKeyAndSubscribe();
  }

  return Notification.requestPermission().then((permission) => {
    if (permission !== "granted") {
      return {
        error: permission === "denied" ? "알림이 차단되었습니다." : "알림 권한이 필요합니다.",
        denied: permission === "denied",
      };
    }
    return loadKeyAndSubscribe();
  });
}

/** @deprecated syncExistingPushSubscriptionToServer 사용 */
export async function ensureGuestPushSubscription(): Promise<void> {
  await syncExistingPushSubscriptionToServer();
}

export async function disableGuestPushNotifications(): Promise<{ ok: true } | { error: string }> {
  await unsubscribeAllPushLocally();

  const removed = await removeAllPushSubscriptions();
  if ("error" in removed) return removed;

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
    return ensureVapidPublicKey().then((key) => {
      if (!key) {
        return Promise.resolve({
          error: "서버 VAPID 키를 불러오지 못했습니다. 페이지를 새로고침해 주세요.",
        });
      }
      return runForceRefresh(key);
    });
  }
  return runForceRefresh(vapidKey);
}

function runForceRefresh(vapidKey: string): Promise<EnablePushResult> {
  if (!("serviceWorker" in navigator)) {
    return Promise.resolve({ error: "서비스 워커를 사용할 수 없습니다." });
  }

  return removeAllPushSubscriptions().then(async (removed) => {
    if ("error" in removed) return removed;
    await unsubscribeAllPushLocally();
    await getServiceWorkerRegistration();
    return subscribeFromGesture(vapidKey, { forceNew: true });
  });
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
