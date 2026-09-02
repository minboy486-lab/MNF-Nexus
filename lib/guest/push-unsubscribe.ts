"use client";

/** 브라우저에 남은 Web Push 구독을 모두 해제합니다. */
export async function unsubscribeAllPushLocally(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  if (navigator.serviceWorker.controller) {
    try {
      const ready = await navigator.serviceWorker.ready;
      const sub = await ready.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {
      /* ignore */
    }
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async (reg) => {
      try {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch {
        /* ignore */
      }
    }),
  );
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
