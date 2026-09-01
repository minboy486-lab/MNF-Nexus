"use client";

import {
  getPushPublicKey,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/actions/guest-push";
import { registerServiceWorker, urlBase64ToUint8Array } from "@/lib/guest/push-client";

export type EnablePushResult =
  | { ok: true }
  | { error: string; denied?: boolean; unsupported?: boolean };

/** 알림 권한 + Web Push 구독 (버튼 탭 등 사용자 동작 후 호출). */
export async function enableGuestPushNotifications(): Promise<EnablePushResult> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { error: "이 기기에서는 알림을 지원하지 않습니다.", unsupported: true };
  }

  const vapidKey = await getPushPublicKey();
  if (!vapidKey) {
    return { error: "서버에 알림 키가 설정되지 않았습니다." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      error: permission === "denied" ? "알림이 차단되었습니다." : "알림 권한이 필요합니다.",
      denied: permission === "denied",
    };
  }

  const reg = await registerServiceWorker();
  if (!reg) return { error: "알림을 사용할 수 없는 환경입니다." };

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { error: "구독에 실패했습니다." };
  }

  const result = await savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });

  if ("error" in result) return { error: result.error };
  return { ok: true };
}

/** 알림 허용 상태에서 구독이 끊겼으면 다시 등록합니다. */
export async function ensureGuestPushSubscription(): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;

  const vapidKey = await getPushPublicKey();
  if (!vapidKey) return;

  const reg = await registerServiceWorker();
  if (!reg) return;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
}

export async function disableGuestPushNotifications(): Promise<{ ok: true } | { error: string }> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await removePushSubscription(endpoint);
  }
  return { ok: true };
}
