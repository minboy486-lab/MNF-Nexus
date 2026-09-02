"use client";

import { fetchServerVapidPublicKey } from "@/lib/guest/fetch-vapid-public-key";
import { getServiceWorkerRegistration } from "@/lib/guest/push-client";

let cachedVapidPublicKey: string | null = null;
let preloadPromise: Promise<void> | null = null;

export function getCachedVapidPublicKey(): string | null {
  return cachedVapidPublicKey;
}

export function setCachedVapidPublicKey(key: string | null): void {
  cachedVapidPublicKey = key;
}

export function resetPushPrefetchCache(): void {
  cachedVapidPublicKey = null;
  preloadPromise = null;
}

async function fetchAndCacheVapidKey(): Promise<string | null> {
  try {
    const key = await fetchServerVapidPublicKey();
    if (key) cachedVapidPublicKey = key;
    return key;
  } catch {
    return null;
  }
}

/** 설정 화면 진입 시 VAPID 키·SW를 미리 준비 (버튼 탭 시 user gesture 유지). */
export function preloadPushEnvironment(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      await fetchAndCacheVapidKey();
      try {
        await getServiceWorkerRegistration();
      } catch {
        /* SW 등록 실패해도 VAPID 키는 사용 가능 */
      }
    })();
  }
  return preloadPromise;
}

export function ensureVapidPublicKey(): Promise<string | null> {
  if (cachedVapidPublicKey) return Promise.resolve(cachedVapidPublicKey);
  return preloadPushEnvironment().then(() => {
    if (cachedVapidPublicKey) return cachedVapidPublicKey;
    return fetchAndCacheVapidKey();
  });
}
