"use client";

export type ServerVapidConfig = {
  publicKey: string | null;
  publicKeyHint: string | null;
  pushConfigured: boolean;
  keysMatch?: boolean;
  adminConfigured: boolean;
  missingPublic?: boolean;
  missingPrivate?: boolean;
  derivedPublicKeyHint?: string | null;
};

export async function fetchServerVapidConfig(): Promise<ServerVapidConfig> {
  try {
    const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      publicKey?: string;
      publicKeyHint?: string;
      pushConfigured?: boolean;
      adminConfigured?: boolean;
      missingPublic?: boolean;
      missingPrivate?: boolean;
      error?: string;
    };

    if (!res.ok || !data.publicKey) {
      return {
        publicKey: null,
        publicKeyHint: null,
        pushConfigured: false,
        adminConfigured: false,
        missingPublic: data.missingPublic,
        missingPrivate: data.missingPrivate,
      };
    }

    return {
      publicKey: data.publicKey,
      publicKeyHint: data.publicKeyHint ?? null,
      pushConfigured: Boolean(data.pushConfigured ?? (data.publicKey && data.keysMatch !== false)),
      keysMatch: data.keysMatch,
      adminConfigured: Boolean(data.adminConfigured),
    };
  } catch {
    return {
      publicKey: null,
      publicKeyHint: null,
      pushConfigured: false,
      adminConfigured: false,
    };
  }
}

export async function fetchServerVapidPublicKey(): Promise<string | null> {
  const config = await fetchServerVapidConfig();
  return config.publicKey;
}
