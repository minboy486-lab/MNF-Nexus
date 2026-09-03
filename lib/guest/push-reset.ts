"use client";

import { removeAllPushSubscriptions } from "@/lib/actions/guest-push";
import { getServiceWorkerRegistration } from "@/lib/guest/push-client";
import { resetPushPrefetchCache } from "@/lib/guest/push-prefetch";
import {
  markSkipPushSyncOnNextLoad,
  unsubscribeAllPushLocally,
} from "@/lib/guest/push-unsubscribe";

/** 기기·서버의 푸시 구독을 모두 지웁니다. (로그아웃·서비스 워커는 유지) */
export async function purgePushOnDevice(): Promise<{ ok: true } | { error: string }> {
  const removed = await removeAllPushSubscriptions();
  if ("error" in removed) return removed;

  await unsubscribeAllPushLocally();
  resetPushPrefetchCache();
  markSkipPushSyncOnNextLoad();
  await getServiceWorkerRegistration();

  return { ok: true };
}

export function isStalePushDeliveryError(message: string): boolean {
  return /예전 푸시 구독|구독이 만료|푸시 구독이 서버와 맞지/.test(message);
}
