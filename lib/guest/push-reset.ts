"use client";

import { removeAllPushSubscriptions } from "@/lib/actions/guest-push";
import { resetPushPrefetchCache } from "@/lib/guest/push-prefetch";
import {
  resetServiceWorkerRegistrationCache,
  unregisterAllServiceWorkers,
} from "@/lib/guest/push-client";
import { unsubscribeAllPushLocally } from "@/lib/guest/push-unsubscribe";

/** 기기·서버의 푸시 구독을 모두 지웁니다. (로그아웃 없음) */
export async function purgePushOnDevice(): Promise<{ ok: true } | { error: string }> {
  const removed = await removeAllPushSubscriptions();
  if ("error" in removed) return removed;

  await unsubscribeAllPushLocally();
  await unregisterAllServiceWorkers();
  resetServiceWorkerRegistrationCache();
  resetPushPrefetchCache();

  return { ok: true };
}

export function isStalePushDeliveryError(message: string): boolean {
  return /예전 푸시 구독|구독이 만료|푸시 구독이 서버와 맞지/.test(message);
}
