export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

export function isPushConfigured(): boolean {
  return Boolean(
    getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim(),
  );
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT?.trim() || "mailto:support@mnfholdem.local";
}
