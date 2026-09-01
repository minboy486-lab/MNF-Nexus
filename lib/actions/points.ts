"use server";

import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/auth/roles";
import { getGuestPointHistory } from "@/lib/data/guest-queries";
import { getProfile } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenueId } from "@/lib/venue/active";
import { mpToWon } from "@/lib/utils/mp";
import { sendPointChangePush } from "@/lib/push/send-point-notification";

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
  if (!isAdminRole(profile?.role)) return { error: "권한이 없습니다." };

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

  const { user, profile } = await getProfile();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!isAdminRole(profile?.role)) return { error: "관리자만 포인트를 조정할 수 있습니다." };

  const memberId = params.memberId?.trim();
  if (!memberId) return { error: "손님을 선택하세요." };

  const deltaMp = Number(params.deltaMp);
  if (!Number.isFinite(deltaMp) || deltaMp === 0) return { error: "조정할 MP를 입력하세요." };

  const deltaWon = mpToWon(deltaMp);
  const supabase = await createClient();
  const venueId = await getActiveVenueId();

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, venue_id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) return { error: memberError.message };
  if (!member) return { error: "손님을 찾을 수 없습니다." };
  if (member.venue_id !== venueId) return { error: "현재 지점의 손님이 아닙니다." };

  const { data, error } = await supabase.rpc("adjust_member_points", {
    p_member_id: memberId,
    p_delta: deltaWon,
    p_note: params.note?.trim() || null,
    p_created_by: user.id,
  });

  if (error) return { error: error.message };

  const result = data as { point_balance?: number; transaction_id?: string } | null;
  const pointBalance = typeof result?.point_balance === "number" ? result.point_balance : 0;
  const transactionId =
    typeof result?.transaction_id === "string" ? result.transaction_id : undefined;

  try {
    await sendPointChangePush({
      memberId,
      deltaMp,
      balanceWon: pointBalance,
      note: params.note?.trim(),
      transactionId,
    });
  } catch (err) {
    console.error("[push] point change notification failed", err);
  }

  revalidatePath("/admin/guests");
  revalidatePath("/guest");
  revalidatePath("/guest/points");

  return {
    ok: true,
    pointBalance,
  };
}
