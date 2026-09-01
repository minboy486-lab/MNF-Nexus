import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { formatMp, mpToWon } from "@/lib/utils/mp";
import { getVapidPublicKey, getVapidSubject, isPushConfigured } from "@/lib/push/vapid";
import { pointNotificationBody, pointNotificationTitle } from "@/lib/ledger/point-history-display";

type Params = {
  memberId: string;
  deltaMp: number;
  balanceWon: number;
  note?: string;
  transactionId?: string;
};

let vapidReady = false;

function ensureVapid() {
  if (vapidReady || !isPushConfigured()) return false;
  webpush.setVapidDetails(
    getVapidSubject(),
    getVapidPublicKey()!,
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  vapidReady = true;
  return true;
}

/** 관리자 포인트 조정 시 손님 기기로 Web Push 발송 (구독자만). */
export async function sendPointChangePush(params: Params): Promise<void> {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured() || !ensureVapid()) return;

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("user_id")
    .eq("id", params.memberId)
    .maybeSingle();

  if (!member?.user_id) {
    console.warn("[push] member has no user_id — guest account not linked", params.memberId);
    return;
  }

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", member.user_id);

  if (subsError) {
    console.error("[push] subscription query failed", subsError.message);
    return;
  }

  if (!subs?.length) {
    console.warn("[push] no subscriptions for user", member.user_id);
    return;
  }

  const absMp = Math.abs(params.deltaMp);
  const txnType = params.deltaMp > 0 ? "point_earn" : "point_spend";
  const title = pointNotificationTitle(txnType);
  const body = [
    pointNotificationBody({ txnType, amountWon: mpToWon(absMp), note: params.note }),
    `잔액 ${formatMp(params.balanceWon)}`,
  ].join(" · ");

  const payload = JSON.stringify({
    title,
    body,
    url: "/guest/points",
    tag: params.transactionId ? `mnf-point-${params.transactionId}` : `mnf-point-${Date.now()}`,
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        {
          TTL: 60 * 60,
          urgency: "high",
          topic: "mnf-point",
        },
      );
      sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      console.error("[push] send failed", { status, endpoint: sub.endpoint.slice(0, 48) });
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  if (sent === 0) {
    console.warn("[push] all deliveries failed for user", member.user_id);
  } else {
    console.info("[push] sent", sent, "notification(s) to user", member.user_id);
  }
}
