"use client";

import {
  pointNotificationBody,
  pointNotificationTitle,
} from "@/lib/ledger/point-history-display";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

async function waitForServiceWorkerControl(
  reg: ServiceWorkerRegistration,
  timeoutMs = 8000,
): Promise<ServiceWorkerRegistration> {
  if (navigator.serviceWorker.controller) return reg;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(reg), timeoutMs);
    const onControllerChange = () => {
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      resolve(reg);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
  });
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    const ready = await navigator.serviceWorker.ready;
    return waitForServiceWorkerControl(ready);
  } catch {
    return null;
  }
}

export function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!registrationPromise) {
    registrationPromise = registerServiceWorker();
  }
  return registrationPromise;
}

export async function showPointNotification(params: {
  txnType: string;
  amountWon: number;
  note?: string | null;
  txnId?: string;
}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const title = pointNotificationTitle(params.txnType);
  const body = pointNotificationBody(params);
  const tag = params.txnId ? `mnf-point-${params.txnId}` : `mnf-point-${Date.now()}`;
  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag,
    renotify: true,
    data: { url: "/guest/points" },
  };

  try {
    const reg = await getServiceWorkerRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
    new Notification(title, { body, icon: "/icons/icon-192.png", tag });
  } catch {
    try {
      new Notification(title, { body, icon: "/icons/icon-192.png", tag });
    } catch {
      /* 알림 표시 실패 */
    }
  }
}
