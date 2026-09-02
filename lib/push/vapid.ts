import { deriveVapidPublicKey, vapidKeysMatch } from "@/lib/push/vapid-pair";

function cleanEnv(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  return trimmed || null;
}

export function getVapidPublicKey(): string | null {
  return (
    cleanEnv(process.env.VAPID_PUBLIC_KEY) ||
    cleanEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

export function getVapidPrivateKey(): string | null {
  return cleanEnv(process.env.VAPID_PRIVATE_KEY);
}

export function isPushConfigured(): boolean {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  return Boolean(publicKey && privateKey && vapidKeysMatch(publicKey, privateKey));
}

export function getVapidSubject(): string {
  return cleanEnv(process.env.VAPID_SUBJECT) || "mailto:support@mnfholdem.local";
}

export function getPublicKeyHint(publicKey: string | null): string | null {
  if (!publicKey || publicKey.length < 12) return publicKey;
  return `${publicKey.slice(0, 6)}…${publicKey.slice(-6)}`;
}

export function getPushConfigStatus() {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  const keysMatch = publicKey && privateKey ? vapidKeysMatch(publicKey, privateKey) : false;
  return {
    publicKey,
    publicKeyHint: getPublicKeyHint(publicKey),
    pushConfigured: Boolean(publicKey && privateKey && keysMatch),
    keysMatch,
    missingPublic: !publicKey,
    missingPrivate: !privateKey,
    derivedPublicKeyHint: privateKey ? getPublicKeyHint(deriveVapidPublicKey(privateKey)) : null,
  };
}
