"use client";

import { disableGuestPushNotifications } from "@/lib/guest/enable-push";
import { resetPushPrefetchCache } from "@/lib/guest/push-prefetch";
import { resetServiceWorkerRegistrationCache, unregisterAllServiceWorkers } from "@/lib/guest/push-client";
import { createClient } from "@/lib/supabase/client";

async function clearCacheStorage(): Promise<void> {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

/** 이 기기에 저장된 손님 앱 데이터를 최대한 지웁니다 (브라우저 설정의 사이트 데이터 삭제와 유사). */
export async function clearGuestSiteData(): Promise<void> {
  try {
    await disableGuestPushNotifications();
  } catch {
    /* 알림이 꺼져 있거나 미지원이어도 계속 */
  }

  await unregisterAllServiceWorkers();
  resetServiceWorkerRegistrationCache();
  resetPushPrefetchCache();

  await clearCacheStorage();

  try {
    localStorage.clear();
  } catch {
    /* private mode */
  }

  try {
    sessionStorage.clear();
  } catch {
    /* private mode */
  }

  const supabase = createClient();
  await supabase.auth.signOut();

  window.location.replace("/login");
}
