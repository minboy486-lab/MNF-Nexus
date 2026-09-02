import { NextResponse } from "next/server";
import { getGuestMember } from "@/lib/data/guest-queries";
import { sendPointChangePush } from "@/lib/push/send-point-notification";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const maxDuration = 30;

/** 손님 설정: 서버 → Web Push 경로 테스트 (백그라운드와 동일). */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const member = await getGuestMember();
  if (!member) {
    return NextResponse.json({ error: "no_member" }, { status: 404 });
  }

  const result = await sendPointChangePush({
    memberId: member.id,
    deltaMp: 1,
    balanceWon: member.point_balance ?? 0,
    note: "서버 푸시 테스트",
    transactionId: `test-server-${Date.now()}`,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.reason,
        detail: result.detail,
        subscriptionCount: result.subscriptionCount,
        publicKeyHint: result.publicKeyHint,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sent: result.sent, total: result.total });
}
