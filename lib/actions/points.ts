"use server";

import { revalidatePath } from "next/cache";
import { canManageGuests } from "@/lib/auth/roles";
import { getGuestPointHistory } from "@/lib/data/guest-queries";
import { getProfile } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveVenueId } from "@/lib/venue/active";
import { mpToWon } from "@/lib/utils/mp";
import { schedulePointChangePush } from "@/lib/push/schedule-point-push";

export type MemberPointHistoryRow = {
  id: string;
  txn_type: string;
  amount: number;
  note: string | null;
  occurred_at: string;
};

export async function fetchMemberPointHistory(
  memberId: string,
): Promise<{ rows: MemberPointHistoryRow[] } | { error: string }> {
  if (!isSupabaseConfigured()) return { rows: [] };

  const { profile } = await getProfile();
  if (!canManageGuests(profile?.role)) return { error: "권한이 없습니다." };

  const id = memberId?.trim();
  if (!id) return { error: "손님을 선택하세요." };

  const venueId = await getActiveVenueId();
  const supabase = await createClient();
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, venue_id")
    .eq("id", id)
    .maybeSingle();

  if (memberError) return { error: memberError.message };
  if (!member) return { error: "손님을 찾을 수 없습니다." };
  if (member.venue_id !== venueId) return { error: "현재 지점의 손님이 아닙니다." };

  const rows = (await getGuestPointHistory(id)) as MemberPointHistoryRow[];
  return { rows };
}

export async function adjustMemberPoints(params: {
  memberId: string;
  deltaMp: number;
  note?: string;
}): Promise<{ ok: true; pointBalance: number } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };
  if (!isSupabaseAdminConfigured()) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY가 필요합니다." };
  }

  const { user, profile } = await getProfile();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!canManageGuests(profile?.role)) return { error: "포인트 조정 권한이 없습니다." };

  const memberId = params.memberId?.trim();
  if (!memberId) return { error: "손님을 선택하세요." };

  const deltaMp = Number(params.deltaMp);
  if (!Number.isFinite(deltaMp) || deltaMp === 0) return { error: "조정할 MP를 입력하세요." };

  const deltaWon = mpToWon(deltaMp);
  const venueId = await getActiveVenueId();
  const admin = createAdminClient();

  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id, venue_id, point_balance, credit_balance")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) return { error: memberError.message };
  if (!member) return { error: "손님을 찾을 수 없습니다." };
  if (member.venue_id !== venueId) return { error: "현재 지점의 손님이 아닙니다." };

  let newPoint = Number(member.point_balance ?? 0) + deltaWon;
  let newCredit = Number(member.credit_balance ?? 0);
  if (newPoint < 0) {
    const overflow = Math.abs(newPoint);
    newPoint = 0;
    newCredit -= overflow;
  }

  const txnType = deltaWon > 0 ? "point_earn" : "point_spend";
  const amount = Math.abs(deltaWon);
  const note = params.note?.trim() || null;

  const { error: updateError } = await admin
    .from("members")
    .update({ point_balance: newPoint, credit_balance: newCredit })
    .eq("id", memberId);

  if (updateError) return { error: updateError.message };

  const { data: txn, error: txnError } = await admin
    .from("money_transactions")
    .insert({
      venue_id: member.venue_id,
      member_id: memberId,
      txn_type: txnType,
      amount,
      payment_method: "points",
      note,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (txnError) return { error: txnError.message };

  schedulePointChangePush({
    memberId,
    deltaMp,
    balanceWon: newPoint,
    note: note ?? undefined,
    transactionId: typeof txn?.id === "string" ? txn.id : undefined,
  });

  revalidatePath("/admin/guests");
  revalidatePath("/guest");
  revalidatePath("/guest/points");

  return {
    ok: true,
    pointBalance: newPoint,
  };
}
