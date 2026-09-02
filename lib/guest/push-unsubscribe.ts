"use client";

import { getServiceWorkerRegistration } from "@/lib/guest/push-client";

/** 브라우저에 남은 Web Push 구독을 모두 해제합니다. */
export async function unsubscribeAllPushLocally(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    await getServiceWorkerRegistration();
  } catch {
    /* SW 없으면 아래 루프만 시도 */
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    let found = false;

    for (const reg of registrations) {
      try {
        const sub = await reg.pushManager.getSubscription();
        if (!sub) continue;
        found = true;
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
    }

    if (!found) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

export async function hasLocalPushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) return true;
  }
  return false;
}

export const SKIP_PUSH_SYNC_COOKIE = "mnf-skip-push-sync";

export function markSkipPushSyncOnNextLoad(): void {
  document.cookie = `${SKIP_PUSH_SYNC_COOKIE}=1; path=/; max-age=300; SameSite=Lax`;
}

export function shouldSkipPushSync(): boolean {
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${SKIP_PUSH_SYNC_COOKIE}=`));
}

export function clearSkipPushSyncCookie(): void {
  document.cookie = `${SKIP_PUSH_SYNC_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
