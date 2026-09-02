import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { getPushConfigStatus } from "@/lib/push/vapid";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getPushConfigStatus();
  if (!status.pushConfigured) {
    return NextResponse.json(
      {
        error: "not_configured",
        missingPublic: status.missingPublic,
        missingPrivate: status.missingPrivate,
        keysMatch: status.keysMatch,
        derivedPublicKeyHint: status.derivedPublicKeyHint,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      publicKey: status.publicKey,
      publicKeyHint: status.publicKeyHint,
      pushConfigured: status.pushConfigured,
      keysMatch: status.keysMatch,
      adminConfigured: isSupabaseAdminConfigured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
