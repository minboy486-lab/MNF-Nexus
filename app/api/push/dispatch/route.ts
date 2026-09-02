import { NextResponse } from "next/server";
import { sendPointChangePush } from "@/lib/push/send-point-notification";

export const maxDuration = 30;

type Body = {
  memberId?: string;
  deltaMp?: number;
  balanceWon?: number;
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

export async function POST(request: Request) {
  const secret = getDispatchSecret();
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const memberId = body.memberId?.trim();
  if (!memberId || typeof body.deltaMp !== "number" || typeof body.balanceWon !== "number") {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  await sendPointChangePush({
    memberId,
    deltaMp: body.deltaMp,
    balanceWon: body.balanceWon,
    note: body.note,
    transactionId: body.transactionId,
  });

  return NextResponse.json({ ok: true });
}
