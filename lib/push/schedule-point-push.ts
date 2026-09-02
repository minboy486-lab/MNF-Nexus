import { headers } from "next/headers";
import { after } from "next/server";
import { sendPointChangePush } from "@/lib/push/send-point-notification";

type PushParams = {
  memberId: string;
  deltaMp: number;
  balanceWon: number;
  note?: string;
  transactionId?: string;
};

function getDispatchSecret(): string | null {
  return (
    process.env.PUSH_DISPATCH_SECRET?.trim() ||
    process.env.VAPID_PRIVATE_KEY?.trim() ||
    null
  );
}

async function getSiteOrigin(): Promise<string | null> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) return siteUrl.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** 포인트 반영 후 별도 요청으로 Web Push 발송 (응답 지연 없음). */
export function schedulePointChangePush(params: PushParams): void {
  after(async () => {
    const secret = getDispatchSecret();
    const origin = await getSiteOrigin();

    if (secret && origin) {
      try {
        const res = await fetch(`${origin}/api/push/dispatch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(params),
        });
        if (res.ok) return;
        console.error("[push] dispatch HTTP", res.status, await res.text());
      } catch (err) {
        console.error("[push] dispatch fetch failed", err);
      }
    }

    try {
      await sendPointChangePush(params);
    } catch (err) {
      console.error("[push] direct send failed", err);
    }
  });
}
