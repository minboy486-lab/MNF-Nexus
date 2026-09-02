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

/** 설정 화면 진입 시 VAPID 키·SW를 미리 준비 (버튼 탭 시 user gesture 유지). */
export function preloadPushEnvironment(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      try {
        const [key] = await Promise.all([
          fetchServerVapidPublicKey().then((k) => {
            if (k) cachedVapidPublicKey = k;
            return k;
          }),
          getServiceWorkerRegistration(),
        ]);
        void key;
      } catch {
        preloadPromise = null;
      }
    })();
  }
  return preloadPromise;
}

export async function requireVapidPublicKey(): Promise<string | null> {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;
  await preloadPushEnvironment();
  if (cachedVapidPublicKey) return cachedVapidPublicKey;
  const key = await fetchServerVapidPublicKey();
  if (key) cachedVapidPublicKey = key;
  return key;
}
