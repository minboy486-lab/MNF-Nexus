"use client";

export function isSecurePushContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext;
}

export function isPushApiAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    isSecurePushContext()
  );
}
