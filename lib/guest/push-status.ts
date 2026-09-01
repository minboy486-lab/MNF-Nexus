"use client";

import { getServiceWorkerRegistration } from "@/lib/guest/push-client";

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await getServiceWorkerRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}
