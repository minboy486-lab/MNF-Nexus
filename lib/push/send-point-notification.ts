import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatMp, mpToWon } from "@/lib/utils/mp";
import { getVapidPublicKey, getVapidSubject, isPushConfigured } from "@/lib/push/vapid";
import { pointNotificationBody, pointNotificationTitle } from "@/lib/ledger/point-history-display";

type Params = {
  memberId: string;
  deltaMp: number;
  balanceWon: number;
  note?: string;
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
  if (!isSupabaseConfigured() || !ensureVapid()) return;

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("user_id")
    .eq("id", params.memberId)
    .maybeSingle();

  if (!member?.user_id) return;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", member.user_id);

  if (!subs?.length) return;

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
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
}
