"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { requireOpenSession } from "@/lib/venue/session";

export async function getMemberForUser() {
  if (!isSupabaseConfigured()) return { member: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { member: null };

  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return { member: data };
}

export async function linkMemberByPhone(phone: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const digits = phone.replace(/\D/g, "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("phone", digits)
    .maybeSingle();

  if (!member) return { error: "등록된 번호가 없습니다. 매장에서 가입하세요." };

  const { error } = await supabase
    .from("members")
    .update({ user_id: user.id })
    .eq("id", member.id);

  if (error) return { error: error.message };

  await supabase.from("profiles").update({ role: "guest" }).eq("id", user.id);

  revalidatePath("/guest");
  return { success: true };
}

export async function requestReservation(message: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const { member } = await getMemberForUser();
  if (!member) return { error: "회원 연동이 필요합니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("approval_requests").insert({
    request_type: "reservation",
    member_id: member.id,
    status: "pending",
    payload: { message },
  });

  if (error) return { error: error.message };
  revalidatePath("/guest");
  return { success: true };
}

export async function requestBuyIn(gameId: string, note?: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const sessionResult = await requireOpenSession();
  if ("error" in sessionResult) return { error: sessionResult.error };

  const { member } = await getMemberForUser();
  if (!member) return { error: "회원 연동이 필요합니다." };

  const supabase = await createClient();
  const { data: visit } = await supabase
    .from("member_visits")
    .select("id")
    .eq("member_id", member.id)
    .eq("venue_session_id", sessionResult.session.id)
    .eq("status", "on_floor")
    .is("checked_out_at", null)
    .maybeSingle();

  if (!visit) return { error: "오늘 방문 등록이 필요합니다. 매장 접수대에서 조회하세요." };

  const { error } = await supabase.from("approval_requests").insert({
    request_type: "buy_in_request",
    member_id: member.id,
    game_id: gameId,
    status: "pending",
    payload: { note, member_visit_id: visit.id },
  });

  if (error) return { error: error.message };
  revalidatePath("/guest");
  return { success: true };
}

export async function requestPointTransfer(
  toPhone: string,
  amount: number,
  message?: string,
) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const { member } = await getMemberForUser();
  if (!member) return { error: "회원 연동이 필요합니다." };
  if (amount <= 0) return { error: "금액을 확인하세요." };
  if (member.point_balance < amount) return { error: "포인트가 부족합니다." };

  const digits = toPhone.replace(/\D/g, "");
  const supabase = await createClient();
  const { data: toMember } = await supabase
    .from("members")
    .select("id, nickname")
    .eq("venue_id", DEFAULT_VENUE_ID)
    .eq("phone", digits)
    .maybeSingle();

  if (!toMember) return { error: "받는 분 번호를 찾을 수 없습니다." };
  if (toMember.id === member.id) return { error: "본인에게는 보낼 수 없습니다." };

  const { error } = await supabase.from("point_transfer_requests").insert({
    venue_id: DEFAULT_VENUE_ID,
    from_member_id: member.id,
    to_member_id: toMember.id,
    amount,
    message: message ?? null,
    status: "pending",
  });

  if (error) return { error: error.message };
  revalidatePath("/guest");
  revalidatePath("/guest/transfer");
  return { success: true };
}

export async function approvePointTransfer(requestId: string) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { data: req } = await supabase
    .from("point_transfer_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!req || req.status !== "pending") return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: from } = await supabase
    .from("members")
    .select("point_balance")
    .eq("id", req.from_member_id)
    .single();

  if (!from || from.point_balance < req.amount) return;

  await supabase
    .from("members")
    .update({ point_balance: from.point_balance - req.amount })
    .eq("id", req.from_member_id);

  const { data: to } = await supabase
    .from("members")
    .select("point_balance")
    .eq("id", req.to_member_id)
    .single();

  await supabase
    .from("members")
    .update({ point_balance: (to?.point_balance ?? 0) + req.amount })
    .eq("id", req.to_member_id);

  await supabase.from("money_transactions").insert([
    {
      venue_id: req.venue_id,
      member_id: req.from_member_id,
      txn_type: "point_spend",
      amount: req.amount,
      payment_method: "points",
      created_by: user?.id ?? null,
    },
    {
      venue_id: req.venue_id,
      member_id: req.to_member_id,
      txn_type: "point_earn",
      amount: req.amount,
      payment_method: "points",
      created_by: user?.id ?? null,
    },
  ]);

  await supabase
    .from("point_transfer_requests")
    .update({
      status: "approved",
      resolved_by: user?.id ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  revalidatePath("/admin/guests");
  revalidatePath("/guest");
}

export async function rejectPointTransfer(requestId: string) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("point_transfer_requests")
    .update({
      status: "rejected",
      resolved_by: user?.id ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  revalidatePath("/guest");
}
