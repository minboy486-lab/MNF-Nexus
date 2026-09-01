import { urlBase64ToUint8Array } from "@/lib/guest/push-client";

function toUint8Array(buffer: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export function subscriptionUsesVapidKey(sub: PushSubscription, vapidPublicKey: string): boolean {
  const existing = sub.options?.applicationServerKey;
  if (!existing) return false;

  const expected = urlBase64ToUint8Array(vapidPublicKey);
  const actual = toUint8Array(existing);
  if (actual.length !== expected.length) return false;

  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}
