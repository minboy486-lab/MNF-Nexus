"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { BlindLevel } from "@/lib/types";

export async function createPreset(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase가 연결되지 않았습니다." };
  }

  const name = String(formData.get("name") ?? "");
  const buyIn = Number(formData.get("buy_in") ?? 0);
  const structureRaw = String(formData.get("blind_structure") ?? "[]");

  let blind_structure: BlindLevel[] = [];
  try {
    blind_structure = JSON.parse(structureRaw) as BlindLevel[];
  } catch {
    return { error: "블라인드 구조 JSON이 올바르지 않습니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("game_presets").insert({
    name,
    buy_in: buyIn,
    blind_structure,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/presets");
  return { success: true };
}

export async function startGame(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase가 연결되지 않았습니다. 데모 모드에서는 게임 개설이 제한됩니다." };
  }

  const presetId = String(formData.get("preset_id") ?? "");
  const tableIds = formData.getAll("physical_table_ids") as string[];

  if (!presetId || tableIds.length === 0) {
    return { error: "프리셋과 물리 테이블을 선택하세요." };
  }

  const supabase = await createClient();
  const { data: preset } = await supabase
    .from("game_presets")
    .select("blind_structure")
    .eq("id", presetId)
    .single();

  const levels = (preset?.blind_structure ?? []) as BlindLevel[];
  const first = levels[0] ?? { level: 1, small: 100, big: 200, ante: 0, minutes: 20 };

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      preset_id: presetId,
      status: "running",
      mode: tableIds.length > 1 ? "multi_table" : "single_table",
    })
    .select("id")
    .single();

  if (gameError || !game) return { error: gameError?.message ?? "게임 생성 실패" };

  await supabase.from("game_clocks").insert({
    game_id: game.id,
    level: first.level,
    remaining_seconds: first.minutes * 60,
    blind_small: first.small,
    blind_big: first.big,
    ante: first.ante,
    is_running: false,
  });

  for (const physicalTableId of tableIds) {
    await supabase.from("game_table_assignments").insert({
      game_id: game.id,
      physical_table_id: physicalTableId,
    });
    await supabase
      .from("physical_tables")
      .update({ current_game_id: game.id })
      .eq("id", physicalTableId);

    for (let seat = 1; seat <= 11; seat++) {
      await supabase.from("seats").insert({
        game_id: game.id,
        physical_table_id: physicalTableId,
        seat_number: seat,
        chips: 0,
      });
    }
  }

  await supabase.from("game_logs").insert({
    game_id: game.id,
    message: `게임 개설 (${tableIds.length}테이블)`,
    level: "info",
  });

  revalidatePath("/admin/tables");
  revalidatePath("/admin/dashboard");
  return { gameId: game.id };
}

export async function toggleClock(gameId: string, isRunning: boolean) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase
    .from("game_clocks")
    .update({ is_running: isRunning, updated_at: new Date().toISOString() })
    .eq("game_id", gameId);

  revalidatePath(`/admin/games/${gameId}`);
}

export async function closeRegistration(gameId: string) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase
    .from("games")
    .update({ registration_closed: true, status: "registration_closed" })
    .eq("id", gameId);

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: "레지 마감",
    level: "info",
  });

  revalidatePath(`/admin/games/${gameId}`);
}

export async function addTableToGame(gameId: string, physicalTableId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  await supabase.from("game_table_assignments").insert({
    game_id: gameId,
    physical_table_id: physicalTableId,
  });
  await supabase
    .from("games")
    .update({ mode: "multi_table" })
    .eq("id", gameId);
  await supabase
    .from("physical_tables")
    .update({ current_game_id: gameId })
    .eq("id", physicalTableId);

  for (let seat = 1; seat <= 11; seat++) {
    await supabase.from("seats").insert({
      game_id: gameId,
      physical_table_id: physicalTableId,
      seat_number: seat,
    });
  }

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: "멀티테이블 전환 — 물리 테이블 추가",
    level: "info",
  });

  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath("/admin/tables");
  return { success: true };
}

export async function assignSeat(
  gameId: string,
  physicalTableId: string,
  seatNumber: number,
  memberId: string,
  memberVisitId?: string | null,
) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase
    .from("seats")
    .update({
      member_id: memberId,
      member_visit_id: memberVisitId ?? null,
      seat_status: "occupied",
      first_sat_at: new Date().toISOString(),
    })
    .eq("game_id", gameId)
    .eq("physical_table_id", physicalTableId)
    .eq("seat_number", seatNumber);

  await supabase.from("members").update({ floor_status: "in_game" }).eq("id", memberId);

  revalidatePath(`/admin/tables/${physicalTableId}`);
  revalidatePath(`/admin/games/${gameId}`);
}

export async function sitOutPlayer(memberId: string, gameId: string) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase
    .from("seats")
    .update({ member_id: null, member_visit_id: null, seat_status: "empty" })
    .eq("member_id", memberId);

  await supabase.from("members").update({ floor_status: "waiting" }).eq("id", memberId);

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: "싯아웃 → 대기 손님",
    level: "info",
  });

  revalidatePath("/admin/guests");
  revalidatePath(`/admin/games/${gameId}`);
}

export async function manualRebuy(
  gameId: string,
  seatId: string,
  memberId: string,
) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { data: seat } = await supabase
    .from("seats")
    .select("rebuy_count")
    .eq("id", seatId)
    .single();

  await supabase
    .from("seats")
    .update({ rebuy_count: (seat?.rebuy_count ?? 0) + 1 })
    .eq("id", seatId);

  const { data: game } = await supabase
    .from("games")
    .select("rebuy_count")
    .eq("id", gameId)
    .single();

  await supabase
    .from("games")
    .update({ rebuy_count: (game?.rebuy_count ?? 0) + 1 })
    .eq("id", gameId);

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: `수동 리바인 (member ${memberId})`,
    level: "info",
  });

  revalidatePath(`/admin/games/${gameId}`);
}

export async function addVisitor(nickname: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { error } = await supabase.from("members").insert({
    nickname,
    floor_status: "visitor",
    venue_id: "00000000-0000-4000-8000-000000000001",
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/guests");
  return { success: true };
}

export async function approveRequest(requestId: string) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { data: req } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!req) return;

  await supabase
    .from("approval_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (req.request_type === "seat_reservation" && req.game_id && req.seat_number && req.physical_table_id) {
    await assignSeat(
      req.game_id,
      req.physical_table_id,
      req.seat_number,
      req.member_id,
    );
  } else {
    await supabase.from("members").update({ floor_status: "in_game" }).eq("id", req.member_id);
  }

  revalidatePath("/admin/guests");
}
