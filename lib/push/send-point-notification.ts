import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { formatMp, mpToWon } from "@/lib/utils/mp";
import { getPublicKeyHint, getVapidPublicKey, getVapidPrivateKey, getVapidSubject, isPushConfigured } from "@/lib/push/vapid";
import { vapidKeysMatch } from "@/lib/push/vapid-pair";
import { pointNotificationBody, pointNotificationTitle } from "@/lib/ledger/point-history-display";

type Params = {
  memberId: string;
  deltaMp: number;
  balanceWon: number;
  note?: string;
  transactionId?: string;
};

export type PushSendResult =
  | { ok: true; sent: number; total: number }
  | {
      ok: false;
      reason: "not_configured" | "no_user" | "no_subscriptions" | "delivery_failed";
      subscriptionCount?: number;
      detail?: string;
      publicKeyHint?: string | null;
    };

let vapidReady = false;

function ensureVapid(): boolean {
  if (!isPushConfigured()) return false;
  if (vapidReady) return true;
  webpush.setVapidDetails(
    getVapidSubject(),
    getVapidPublicKey()!,
    getVapidPrivateKey()!,
  );
  vapidReady = true;
  return true;
}

function pushFailureReason(status?: number): string {
  if (status === 401 || status === 403) {
    return "기기에 예전 푸시 구독이 남아 있습니다. 알림 끄기 → 사이트 데이터 삭제 → 다시 켜 주세요.";
  }
  if (status === 404 || status === 410) return "구독이 만료되었습니다. 알림을 다시 켜 주세요.";
  if (status) return `푸시 서버 오류 (${status})`;
  return "푸시 전송에 실패했습니다.";
}

/** 관리자 포인트 조정 시 손님 기기로 Web Push 발송 (구독자만). */
export async function sendPointChangePush(params: Params): Promise<PushSendResult> {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return { ok: false, reason: "not_configured", detail: "SUPABASE_SERVICE_ROLE_KEY가 필요합니다." };
  }
  if (!ensureVapid()) {
    return {
      ok: false,
      reason: "not_configured",
      detail: "VAPID 키(NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)가 필요합니다.",
    };
  }

  const publicKey = getVapidPublicKey()!;
  const privateKey = getVapidPrivateKey()!;
  if (!vapidKeysMatch(publicKey, privateKey)) {
    return {
      ok: false,
      reason: "not_configured",
      detail:
        "VAPID 공개키와 비밀키가 한 쌍이 아닙니다. npm run vapid:generate 결과를 Vercel에 다시 넣어 주세요.",
      publicKeyHint: getPublicKeyHint(publicKey),
    };
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("user_id")
    .eq("id", params.memberId)
    .maybeSingle();

  if (!member?.user_id) {
    console.warn("[push] member has no user_id — guest account not linked", params.memberId);
    return { ok: false, reason: "no_user", detail: "로그인 계정이 연결되지 않은 손님입니다." };
  }

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", member.user_id);

  if (subsError) {
    console.error("[push] subscription query failed", subsError.message);
    return { ok: false, reason: "delivery_failed", detail: subsError.message };
  }

  if (!subs?.length) {
    console.warn("[push] no subscriptions for user", member.user_id);
    return { ok: false, reason: "no_subscriptions", subscriptionCount: 0 };
  }

  const absMp = Math.abs(params.deltaMp);
  const txnType = params.deltaMp > 0 ? "point_earn" : "point_spend";
  const amountWon = mpToWon(absMp);
  const title = pointNotificationTitle(txnType);
  const body = [
    pointNotificationBody({ txnType, amountWon, note: params.note }),
    `잔액 ${formatMp(params.balanceWon)}`,
  ].join(" · ");

  const payload = JSON.stringify({
    title,
    body,
    url: "/guest/points",
    tag: params.transactionId ? `mnf-point-${params.transactionId}` : `mnf-point-${Date.now()}`,
    txnType,
    amountWon,
    note: params.note ?? "",
    txnId: params.transactionId ?? "",
  });

  let sent = 0;
  let lastDetail: string | undefined;

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
        },
      );
      sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      lastDetail = pushFailureReason(status);
      console.error("[push] send failed", { status, endpoint: sub.endpoint.slice(0, 48) });
      if (status === 404 || status === 410 || status === 401 || status === 403) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  if (sent === 0) {
    console.warn("[push] all deliveries failed for user", member.user_id);
    return {
      ok: false,
      reason: "delivery_failed",
      subscriptionCount: subs.length,
      detail: lastDetail,
      publicKeyHint: getPublicKeyHint(getVapidPublicKey()),
    };
  }

  console.info("[push] sent", sent, "notification(s) to user", member.user_id);
  return { ok: true, sent, total: subs.length };
}
