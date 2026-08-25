"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";
import { requireOpenSession } from "@/lib/venue/session";
import { recordBuyIn, recordRebuy, type PaymentMethod } from "@/lib/actions/ledger";
import { renumberRanks, renumberRebuyOrders } from "@/lib/presets/preset-form";
import { insertGamePresetRow, updateGamePresetRow } from "@/lib/presets/preset-db";
import { getPlayLevels, serializeStructure, validateStructureForSave } from "@/lib/presets/structure";
import { isUuid } from "@/lib/utils/uuid";
import { formatMp } from "@/lib/utils/mp";
import type {
  BlindLevel,
  BlindStructureRow,
  PresetGameKind,
  PrizePlacement,
} from "@/lib/types";

async function nextDailyGameNumber(sessionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("daily_game_number")
    .eq("venue_session_id", sessionId)
    .order("daily_game_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.daily_game_number ?? 0) + 1;
}

export type CreatePresetPayload = {
  name: string;
  game_kind: PresetGameKind;
  buy_in: number;
  rebuy_cost: number;
  addon_enabled: boolean;
  addon_price: number;
  buy_in_chips: number;
  rebuy_chips: { order: number; chips: number }[];
  addon_chips: number;
  bonus_enabled: boolean;
  bonus_chips: number;
  blind_structure: BlindStructureRow[];
  placements: PrizePlacement[];
  win_points: { rank: number; points: number }[];
  participation_points: number;
  prize_pool_percent: number;
  gtd_enabled?: boolean;
  gtd_amount?: number;
  gtd_entry_threshold?: number;
};

export type PresetMutationResult =
  | { success: true; id?: string }
  | { error: string };

export async function createPresetFromPayload(
  payload: CreatePresetPayload,
): Promise<PresetMutationResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase가 연결되지 않았습니다." };
  }

  if (!payload.name.trim()) {
    return { error: "이름을 입력하세요." };
  }

  const structureError = validatePresetPayload(payload);
  if (structureError) return { error: structureError };

  const supabase = await createClient();
  const result = await insertGamePresetRow(supabase, buildPresetRow(payload));

  if ("error" in result) return { error: result.error };
  revalidatePath("/admin/presets");
  return { success: true, id: result.id };
}

function validatePresetPayload(payload: CreatePresetPayload): string | null {
  const structureError = validateStructureForSave(payload.blind_structure);
  if (structureError) return structureError;
  if (payload.gtd_enabled) {
    if (!payload.gtd_amount) return "GTD 금액을 입력하세요.";
    if (!payload.gtd_entry_threshold) return "GTD 기준 엔트리를 입력하세요.";
  }
  return null;
}

function buildPresetRow(payload: CreatePresetPayload) {
  const blind_structure = serializeStructure(payload.blind_structure);
  const gtdEnabled = Boolean(payload.gtd_enabled);
  const prize_rules = {
    placements: renumberRanks(payload.placements),
    win_points: renumberRanks(payload.win_points),
    participation_points: Math.max(0, payload.participation_points),
    buy_in_chips: payload.buy_in_chips,
    rebuy_chips: renumberRebuyOrders(payload.rebuy_chips),
    gtd_enabled: gtdEnabled,
    gtd_amount: gtdEnabled ? Math.max(0, payload.gtd_amount ?? 0) : 0,
    gtd_entry_threshold: gtdEnabled ? Math.max(0, payload.gtd_entry_threshold ?? 0) : 0,
  };
  return {
    name: payload.name.trim(),
    game_kind: payload.game_kind,
    buy_in: payload.buy_in,
    rebuy_cost: payload.rebuy_cost,
    addon_enabled: payload.addon_enabled,
    addon_price: payload.addon_enabled ? payload.addon_price : 0,
    buy_in_chips: payload.buy_in_chips,
    rebuy_chips: renumberRebuyOrders(payload.rebuy_chips),
    rebuy1_chips: payload.rebuy_chips[0]?.chips ?? 0,
    rebuy2_chips: payload.rebuy_chips[1]?.chips ?? 0,
    addon_chips: payload.addon_enabled ? payload.addon_chips : 0,
    bonus_enabled: payload.bonus_enabled,
    bonus_chips: payload.bonus_enabled ? payload.bonus_chips : 0,
    participation_points: Math.max(0, payload.participation_points),
    prize_pool_percent: Math.min(100, Math.max(0, payload.prize_pool_percent)),
    blind_structure,
    prize_rules,
  };
}

export async function updatePresetFromPayload(
  id: string,
  payload: CreatePresetPayload,
): Promise<PresetMutationResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase가 연결되지 않았습니다." };
  }
  if (!isUuid(id)) {
    return { error: "저장된 블라인드만 수정할 수 있습니다. (데모 데이터)" };
  }
  if (!payload.name.trim()) {
    return { error: "이름을 입력하세요." };
  }
  const structureError = validatePresetPayload(payload);
  if (structureError) return { error: structureError };

  const supabase = await createClient();
  const result = await updateGamePresetRow(supabase, id, buildPresetRow(payload));

  if ("error" in result) return { error: result.error };
  revalidatePath("/admin/presets");
  return { success: true };
}

export async function deletePreset(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase가 연결되지 않았습니다." };
  }
  if (!isUuid(id)) {
    return { error: "저장된 블라인드만 삭제할 수 있습니다. (데모 데이터)" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("game_presets").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/presets");
  return { success: true };
}

/** @deprecated Use createPresetFromPayload */
export async function createPreset(formData: FormData) {
  const structureRaw = String(formData.get("blind_structure") ?? "[]");
  let blind_structure: BlindStructureRow[] = [];
  try {
    blind_structure = JSON.parse(structureRaw) as BlindStructureRow[];
  } catch {
    return { error: "블라인드 구조 JSON이 올바르지 않습니다." };
  }
  return createPresetFromPayload({
    name: String(formData.get("name") ?? ""),
    game_kind: "daily",
    buy_in: Number(formData.get("buy_in") ?? 0),
    rebuy_cost: 0,
    addon_enabled: false,
    addon_price: 0,
    buy_in_chips: 0,
    rebuy_chips: [{ order: 1, chips: 0 }],
    addon_chips: 0,
    bonus_enabled: false,
    bonus_chips: 0,
    blind_structure,
    placements: [],
    win_points: [],
    participation_points: 0,
    prize_pool_percent: 100,
  });
}

export type StartGameResult =
  | { gameId: string; dailyNumber: number }
  | { error: string };

export async function startGameFromSelection(input: {
  presetId: string;
  physicalTableIds: string[];
}): Promise<StartGameResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase가 연결되지 않았습니다. 데모 모드에서는 게임 개설이 제한됩니다." };
  }

  const sessionResult = await requireOpenSession();
  if ("error" in sessionResult) {
    return { error: sessionResult.error ?? "영업 세션이 열려 있지 않습니다." };
  }

  const presetId = input.presetId.trim();
  const tableIds = [...new Set(input.physicalTableIds.filter(Boolean))];

  if (!presetId || tableIds.length === 0) {
    return { error: "블라인드와 물리 테이블을 선택하세요." };
  }

  const supabase = await createClient();
  const { data: busyTables } = await supabase
    .from("physical_tables")
    .select("id, code, current_game_id")
    .in("id", tableIds);

  const inUse = (busyTables ?? []).filter((t) => t.current_game_id);
  if (inUse.length > 0) {
    const codes = inUse.map((t) => t.code).join(", ");
    return { error: `사용 중인 테이블이 있습니다: ${codes}` };
  }

  const { data: preset } = await supabase
    .from("game_presets")
    .select("blind_structure, buy_in")
    .eq("id", presetId)
    .single();

  const levels = getPlayLevels((preset?.blind_structure ?? []) as BlindStructureRow[]);
  const first = levels[0] ?? {
    kind: "level" as const,
    level: 1,
    small: 100,
    big: 200,
    ante: 0,
    minutes: 20,
  };
  const dailyNumber = await nextDailyGameNumber(sessionResult.session.id);

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      preset_id: presetId,
      venue_id: DEFAULT_VENUE_ID,
      venue_session_id: sessionResult.session.id,
      daily_game_number: dailyNumber,
      status: "running",
      mode: tableIds.length > 1 ? "multi_table" : "single_table",
      button_seat: null,
      survivor_count: 0,
      entry_count: 0,
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
  revalidatePath("/admin/operations");
  return { gameId: game.id, dailyNumber };
}

/** @deprecated Prefer startGameFromSelection — kept for server form actions */
export async function startGame(formData: FormData) {
  return startGameFromSelection({
    presetId: String(formData.get("preset_id") ?? ""),
    physicalTableIds: formData.getAll("physical_table_ids") as string[],
  });
}

/** 테이블 상세에서 빠른 게임 시작 (기본 프리셋 1개). */
export async function quickStartGameOnTable(physicalTableId: string, presetId?: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { data: table } = await supabase
    .from("physical_tables")
    .select("current_game_id, code")
    .eq("id", physicalTableId)
    .single();

  if (table?.current_game_id) {
    return { error: "이미 게임이 진행 중입니다.", gameId: table.current_game_id };
  }

  let pid = presetId;
  if (!pid) {
    const { data: presets } = await supabase
      .from("game_presets")
      .select("id")
      .order("name")
      .limit(1);
    pid = presets?.[0]?.id;
  }
  if (!pid) return { error: "블라인드 맵이 없습니다." };

  const fd = new FormData();
  fd.set("preset_id", pid);
  fd.append("physical_table_ids", physicalTableId);
  fd.set("draw_button", "on");
  return startGame(fd);
}

/** 통합 테이블 뷰 임시: 프라이즈 정산 없이 게임 종료 */
export async function quickEndGameOnTable(physicalTableId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { data: table } = await supabase
    .from("physical_tables")
    .select("current_game_id, code")
    .eq("id", physicalTableId)
    .single();

  const gameId = table?.current_game_id;
  if (!gameId) return { error: "진행 중인 게임이 없습니다." };

  await supabase
    .from("games")
    .update({ status: "ended", updated_at: new Date().toISOString() })
    .eq("id", gameId);

  await supabase
    .from("game_clocks")
    .update({ is_running: false, updated_at: new Date().toISOString() })
    .eq("game_id", gameId);

  await supabase
    .from("physical_tables")
    .update({ current_game_id: null })
    .eq("current_game_id", gameId);

  const { data: occupiedSeats } = await supabase
    .from("seats")
    .select("member_id")
    .eq("game_id", gameId)
    .not("member_id", "is", null);

  const memberIds = [
    ...new Set(
      (occupiedSeats ?? [])
        .map((s) => s.member_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  await supabase
    .from("seats")
    .update({
      member_id: null,
      member_visit_id: null,
      seat_status: "empty",
      chips: 0,
      rebuy_count: 0,
      buy_in_count: 0,
      first_payment_method: null,
      last_payment_method: null,
    })
    .eq("game_id", gameId);

  if (memberIds.length > 0) {
    await supabase
      .from("members")
      .update({ floor_status: "waiting" })
      .in("id", memberIds);
  }

  await supabase.from("game_logs").insert({
    game_id: gameId,
    physical_table_id: physicalTableId,
    message: `임시 게임 종료 (테이블 ${table?.code ?? ""})`,
    level: "info",
  });

  revalidatePath("/admin/tables");
  revalidatePath(`/admin/tables/${physicalTableId}`);
  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/operations");
  return { success: true, gameId };
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

  const { data: game } = await supabase
    .from("games")
    .select("id, status")
    .eq("id", gameId)
    .maybeSingle();

  if (!game) return { error: "게임을 찾을 수 없습니다." };
  if (game.status !== "running" && game.status !== "registration_closed") {
    return { error: "진행 중인 게임에만 테이블을 추가할 수 있습니다." };
  }

  const { data: physTable } = await supabase
    .from("physical_tables")
    .select("id, code, current_game_id")
    .eq("id", physicalTableId)
    .maybeSingle();

  if (!physTable) return { error: "테이블을 찾을 수 없습니다." };
  if (physTable.current_game_id) {
    return { error: `테이블 ${physTable.code}는 이미 게임 중입니다.` };
  }

  const { data: existing } = await supabase
    .from("game_table_assignments")
    .select("id")
    .eq("game_id", gameId)
    .eq("physical_table_id", physicalTableId)
    .maybeSingle();

  if (existing) return { error: "이미 같은 게임에 연결된 테이블입니다." };

  const { error: assignError } = await supabase.from("game_table_assignments").insert({
    game_id: gameId,
    physical_table_id: physicalTableId,
  });
  if (assignError) return { error: assignError.message };

  await supabase.from("games").update({ mode: "multi_table" }).eq("id", gameId);
  await supabase
    .from("physical_tables")
    .update({ current_game_id: gameId })
    .eq("id", physicalTableId);

  for (let seat = 1; seat <= 11; seat++) {
    const { error: seatError } = await supabase.from("seats").insert({
      game_id: gameId,
      physical_table_id: physicalTableId,
      seat_number: seat,
      chips: 0,
    });
    if (seatError) return { error: seatError.message };
  }

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: `멀티테이블 전환 — 테이블 ${physTable.code} 추가`,
    level: "info",
  });

  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath("/admin/tables");
  revalidatePath("/staff/tables");
  return { success: true, gameId };
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

export async function assignSeatWithBuyIn(
  gameId: string,
  physicalTableId: string,
  seatNumber: number,
  memberId: string,
  amount: number,
  paymentMethod: PaymentMethod = "cash",
  memberVisitId?: string | null,
) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { data: seat } = await supabase
    .from("seats")
    .select("id, member_id")
    .eq("game_id", gameId)
    .eq("physical_table_id", physicalTableId)
    .eq("seat_number", seatNumber)
    .single();

  if (!seat) return { error: "좌석을 찾을 수 없습니다." };
  if (seat.member_id) return { error: "이미 착석한 좌석입니다." };

  const { data: seatedInActive } = await supabase
    .from("seats")
    .select("id, games!inner(status)")
    .eq("member_id", memberId)
    .in("games.status", ["running", "registration_closed"])
    .limit(1)
    .maybeSingle();

  if (seatedInActive) return { error: "이미 게임 중인 손님입니다." };

  await assignSeat(gameId, physicalTableId, seatNumber, memberId, memberVisitId);

  const buyInResult = await recordBuyIn(
    gameId,
    seat.id,
    memberId,
    amount,
    paymentMethod,
    memberVisitId,
  );
  if ("error" in buyInResult && buyInResult.error) return buyInResult;

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: `바이인 ${formatMp(amount)} — 좌석 ${seatNumber}`,
    level: "info",
  });

  revalidatePath(`/admin/tables/${physicalTableId}`);
  revalidatePath(`/admin/games/${gameId}`);
  return { success: true };
}

export async function moveSeat(
  gameId: string,
  memberId: string,
  toPhysicalTableId: string,
  toSeatNumber: number,
) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { data: fromSeat } = await supabase
    .from("seats")
    .select("*")
    .eq("game_id", gameId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (!fromSeat) return { error: "현재 좌석을 찾을 수 없습니다." };

  const { data: toSeat } = await supabase
    .from("seats")
    .select("id, member_id")
    .eq("game_id", gameId)
    .eq("physical_table_id", toPhysicalTableId)
    .eq("seat_number", toSeatNumber)
    .single();

  if (!toSeat) return { error: "이동할 좌석이 없습니다." };
  if (toSeat.member_id) return { error: "대상 좌석이 비어 있지 않습니다." };

  await supabase
    .from("seats")
    .update({
      member_id: null,
      member_visit_id: null,
      seat_status: "empty",
    })
    .eq("id", fromSeat.id);

  await supabase
    .from("seats")
    .update({
      member_id: memberId,
      member_visit_id: fromSeat.member_visit_id,
      seat_status: "occupied",
      chips: fromSeat.chips,
      rebuy_count: fromSeat.rebuy_count,
      buy_in_count: fromSeat.buy_in_count,
      first_payment_method: fromSeat.first_payment_method,
      last_payment_method: fromSeat.last_payment_method,
      first_sat_at: fromSeat.first_sat_at,
      last_rebuy_at: fromSeat.last_rebuy_at,
    })
    .eq("id", toSeat.id);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("seat_moves").insert({
    game_id: gameId,
    member_id: memberId,
    from_physical_table_id: fromSeat.physical_table_id,
    from_seat_number: fromSeat.seat_number,
    to_physical_table_id: toPhysicalTableId,
    to_seat_number: toSeatNumber,
    moved_by: user?.id ?? null,
  });

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: `좌석 이동 S${fromSeat.seat_number} → S${toSeatNumber}`,
    level: "info",
  });

  revalidatePath(`/admin/tables/${fromSeat.physical_table_id}`);
  revalidatePath(`/admin/tables/${toPhysicalTableId}`);
  revalidatePath("/admin/tables");
  revalidatePath("/staff/tables");
  revalidatePath(`/admin/games/${gameId}`);
  return { success: true };
}

export async function sitOutPlayer(memberId: string, gameId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();

  const seatUpdate = await supabase
    .from("seats")
    .update({
      member_id: null,
      member_visit_id: null,
      seat_status: "empty",
      chips: 0,
      rebuy_count: 0,
      buy_in_count: 0,
      first_payment_method: null,
      last_payment_method: null,
    })
    .eq("game_id", gameId)
    .eq("member_id", memberId);

  if (seatUpdate.error) {
    const fallback = await supabase
      .from("seats")
      .update({
        member_id: null,
        member_visit_id: null,
        seat_status: "empty",
        chips: 0,
        rebuy_count: 0,
      })
      .eq("game_id", gameId)
      .eq("member_id", memberId);
    if (fallback.error) return { error: fallback.error.message };
  }

  const memberUpdate = await supabase
    .from("members")
    .update({ floor_status: "waiting" })
    .eq("id", memberId);

  if (memberUpdate.error) return { error: memberUpdate.error.message };

  const { count: remaining } = await supabase
    .from("seats")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .not("member_id", "is", null);

  await supabase
    .from("games")
    .update({ survivor_count: remaining ?? 0 })
    .eq("id", gameId);

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: "싯아웃 → 대기 손님",
    level: "info",
  });

  revalidatePath("/admin/guests");
  revalidatePath("/admin/tables");
  revalidatePath("/staff/tables");
  revalidatePath(`/admin/games/${gameId}`);
  return { success: true };
}

export async function fetchMemberBuyInLogs(gameId: string, memberId: string) {
  const { getMemberBuyInLogs } = await import("@/lib/data/seat-enrichment");
  return getMemberBuyInLogs(gameId, memberId);
}

export async function manualRebuy(
  gameId: string,
  seatId: string,
  memberId: string,
  amount?: number,
  paymentMethod: PaymentMethod = "cash",
) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  let rebuyAmount = amount;
  if (rebuyAmount == null) {
    const { data: game } = await supabase
      .from("games")
      .select("preset_id, game_presets(buy_in)")
      .eq("id", gameId)
      .single();
    const preset = game?.game_presets as { buy_in?: number } | null;
    rebuyAmount = preset?.buy_in ?? 0;
  }

  if (rebuyAmount > 0) {
    const result = await recordRebuy(gameId, seatId, memberId, rebuyAmount, paymentMethod);
    if (result && "error" in result && result.error) return { error: result.error };
  } else {
    const { data: seat } = await supabase
      .from("seats")
      .select("rebuy_count")
      .eq("id", seatId)
      .single();

    const { data: existing } = await supabase
      .from("game_member_buy_ins")
      .select("buy_in_count")
      .eq("game_id", gameId)
      .eq("member_id", memberId)
      .maybeSingle();

    const nextBuyIn = (existing?.buy_in_count ?? 0) + 1;

    await supabase.from("game_member_buy_ins").upsert(
      { game_id: gameId, member_id: memberId, buy_in_count: nextBuyIn },
      { onConflict: "game_id,member_id" },
    );

    await supabase
      .from("seats")
      .update({
        rebuy_count: (seat?.rebuy_count ?? 0) + 1,
        buy_in_count: nextBuyIn,
        last_payment_method: paymentMethod,
        last_rebuy_at: new Date().toISOString(),
      })
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
  }

  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath("/admin/tables");
  revalidatePath("/staff/tables");
  return { success: true };
}

export async function advanceBlindLevel(gameId: string) {
  if (!isSupabaseConfigured()) return { error: "데모 모드" };

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("preset_id, game_presets(blind_structure)")
    .eq("id", gameId)
    .single();

  const { data: clock } = await supabase
    .from("game_clocks")
    .select("*")
    .eq("game_id", gameId)
    .single();

  if (!clock) return { error: "타이머 없음" };

  const levels = getPlayLevels(
    ((game?.game_presets as { blind_structure?: BlindStructureRow[] } | null)
      ?.blind_structure ?? []) as BlindStructureRow[],
  );

  const nextLevelNum = clock.level + 1;
  const next = levels.find((l) => l.level === nextLevelNum);

  if (!next) {
    return { error: "마지막 레벨입니다." };
  }

  await supabase
    .from("game_clocks")
    .update({
      level: next.level,
      remaining_seconds: next.minutes * 60,
      blind_small: next.small,
      blind_big: next.big,
      ante: next.ante ?? 0,
      is_running: true,
      version: (clock.version ?? 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("game_id", gameId);

  await supabase.from("game_logs").insert({
    game_id: gameId,
    message: `Level ${next.level} — ${next.small}/${next.big}`,
    level: "info",
  });

  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath("/admin/operations");
  return { success: true, level: next.level };
}

export async function syncClockRemaining(gameId: string, remainingSeconds: number) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase
    .from("game_clocks")
    .update({
      remaining_seconds: Math.max(0, remainingSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq("game_id", gameId);
}

export async function addVisitor(nickname: string) {
  const slug = nickname.trim().toLowerCase().replace(/\s+/g, "_") || "guest";
  const { createMember } = await import("@/lib/actions/members");
  return createMember({
    loginId: `${slug}_${Date.now().toString(36)}`,
    password: "0000",
    nickname: nickname.trim(),
  });
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("approval_requests")
    .update({ status: "approved", approved_by: user?.id ?? null })
    .eq("id", requestId);

  if (req.request_type === "seat_reservation" && req.game_id && req.seat_number && req.physical_table_id) {
    await assignSeat(
      req.game_id,
      req.physical_table_id,
      req.seat_number,
      req.member_id,
    );
  } else if (
    (req.request_type === "buy_in_request" || req.request_type === "buy_in") &&
    req.game_id
  ) {
    const payload = (req.payload ?? {}) as { member_visit_id?: string; amount?: number };
    const { data: game } = await supabase
      .from("games")
      .select("preset_id, game_presets(buy_in)")
      .eq("id", req.game_id)
      .single();
    const buyIn =
      payload.amount ??
      (game?.game_presets as { buy_in?: number } | null)?.buy_in ??
      0;

    const { data: emptySeat } = await supabase
      .from("seats")
      .select("id, physical_table_id, seat_number")
      .eq("game_id", req.game_id)
      .is("member_id", null)
      .order("seat_number")
      .limit(1)
      .maybeSingle();

    if (emptySeat) {
      await assignSeatWithBuyIn(
        req.game_id,
        emptySeat.physical_table_id,
        emptySeat.seat_number,
        req.member_id,
        buyIn,
        "cash",
        payload.member_visit_id,
      );
    }
  } else if (req.request_type === "participation") {
    await supabase.from("members").update({ floor_status: "in_game" }).eq("id", req.member_id);
  } else if (req.request_type === "reservation") {
    await supabase.from("members").update({ floor_status: "reserved" }).eq("id", req.member_id);
  }

  revalidatePath("/admin/guests");
  revalidatePath("/guest");
}
