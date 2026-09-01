"use client";

import { getServiceWorkerRegistration } from "@/lib/guest/push-client";

export async function getLocalPushEndpoint(): Promise<string | null> {
  if (!("Notification" in window) || Notification.permission !== "granted") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await getServiceWorkerRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub?.endpoint ?? null;
  } catch {
    return null;
  }
}

export async function hasActivePushSubscription(): Promise<boolean> {
  const endpoint = await getLocalPushEndpoint();
  return Boolean(endpoint);
}
