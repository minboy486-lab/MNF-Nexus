"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getVapidPublicKey } from "@/lib/push/vapid";

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function getPushPublicKey(): Promise<string | null> {
  return getVapidPublicKey();
}

export async function savePushSubscription(
  subscription: PushSubscriptionPayload,
): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "연결되지 않았습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const endpoint = subscription.endpoint?.trim();
  const p256dh = subscription.keys?.p256dh?.trim();
  const auth = subscription.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) return { error: "구독 정보가 올바르지 않습니다." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) return { error: error.message };
  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string,
): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "연결되지 않았습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint.trim());

  if (error) return { error: error.message };
  return { ok: true };
}
