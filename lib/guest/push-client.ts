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

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
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

  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) {
    await reg.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      renotify: true,
      data: { url: "/guest/points" },
    });
    return;
  }

  new Notification(title, { body, icon: "/icons/icon-192.png", tag });
}
