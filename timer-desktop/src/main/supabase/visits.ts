import { getSupabase } from "./client";
import { getConfiguredVenueId } from "./venue";
import { requireOpenVenueSession } from "./venueSession";

export type OnFloorGuest = {
  visitId: string;
  memberId: string;
  nickname: string;
  displayName: string | null;
  phone: string | null;
  checkedInAt: string;
};

export type SessionGuest = OnFloorGuest & {
  checkedOutAt: string | null;
  onFloor: boolean;
};

function mapVisitRow(row: {
  id: string;
  member_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  status: string;
  members: { id: string; nickname: string; display_name: string | null; phone: string | null } | { id: string; nickname: string; display_name: string | null; phone: string | null }[] | null;
}): SessionGuest | null {
  const raw = row.members;
  const m = Array.isArray(raw) ? raw[0] : raw;
  if (!m) return null;
  const onFloor = row.status === "on_floor" && row.checked_out_at == null;
  return {
    visitId: row.id,
    memberId: m.id,
    nickname: m.nickname,
    displayName: m.display_name,
    phone: m.phone,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
    onFloor,
  };
}

export async function listTodaySessionGuests(): Promise<SessionGuest[] | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase에 연결할 수 없습니다." };
  const sessionResult = await requireOpenVenueSession();
  if ("error" in sessionResult) return sessionResult;
  const venueId = getConfiguredVenueId();
  const { data, error } = await sb
    .from("member_visits")
    .select("id, member_id, checked_in_at, checked_out_at, status, members(id, nickname, display_name, phone)")
    .eq("venue_id", venueId)
    .eq("venue_session_id", sessionResult.session.id)
    .order("checked_in_at", { ascending: true });
  if (error) return { error: error.message };

  const out: SessionGuest[] = [];
  for (const row of data ?? []) {
    const guest = mapVisitRow(row as Parameters<typeof mapVisitRow>[0]);
    if (guest) out.push(guest);
  }

  out.sort((a, b) => {
    if (a.onFloor !== b.onFloor) return a.onFloor ? -1 : 1;
    return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime();
  });
  return dedupeSessionGuests(out);
}

/** 회원당 1행: 재실 중이면 퇴장 기록 숨김, 퇴장만 있으면 최근 1건만 */
function dedupeSessionGuests(guests: SessionGuest[]): SessionGuest[] {
  const byMember = new Map<string, SessionGuest[]>();
  for (const g of guests) {
    const list = byMember.get(g.memberId) ?? [];
    list.push(g);
    byMember.set(g.memberId, list);
  }

  const result: SessionGuest[] = [];
  for (const list of byMember.values()) {
    const active = list.filter((g) => g.onFloor);
    if (active.length > 0) {
      active.sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());
      result.push(active[0]!);
      continue;
    }
    const left = list.filter((g) => !g.onFloor);
    left.sort(
      (a, b) =>
        new Date(b.checkedOutAt ?? b.checkedInAt).getTime() -
        new Date(a.checkedOutAt ?? a.checkedInAt).getTime(),
    );
    if (left[0]) result.push(left[0]);
  }

  result.sort((a, b) => {
    if (a.onFloor !== b.onFloor) return a.onFloor ? -1 : 1;
    return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime();
  });
  return result;
}

export async function listOnFloorToday(): Promise<OnFloorGuest[] | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase에 연결할 수 없습니다." };
  const sessionResult = await requireOpenVenueSession();
  if ("error" in sessionResult) return sessionResult;
  const venueId = getConfiguredVenueId();
  const { data, error } = await sb
    .from("member_visits")
    .select("id, member_id, checked_in_at, checked_out_at, status, members(id, nickname, display_name, phone)")
    .eq("venue_id", venueId)
    .eq("venue_session_id", sessionResult.session.id)
    .eq("status", "on_floor")
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: true });
  if (error) return { error: error.message };
  const out: OnFloorGuest[] = [];
  for (const row of data ?? []) {
    const guest = mapVisitRow(row as Parameters<typeof mapVisitRow>[0]);
    if (!guest?.onFloor) continue;
    out.push({
      visitId: guest.visitId,
      memberId: guest.memberId,
      nickname: guest.nickname,
      displayName: guest.displayName,
      phone: guest.phone,
      checkedInAt: guest.checkedInAt,
    });
  }
  return out;
}

export async function checkInMember(memberId: string): Promise<{ visitId: string } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase에 연결할 수 없습니다." };
  const sessionResult = await requireOpenVenueSession();
  if ("error" in sessionResult) return sessionResult;
  const venueId = getConfiguredVenueId();

  const { data: already } = await sb
    .from("member_visits")
    .select("id")
    .eq("member_id", memberId)
    .eq("venue_session_id", sessionResult.session.id)
    .eq("status", "on_floor")
    .is("checked_out_at", null)
    .maybeSingle();
  if (already) return { error: "이미 방문 중입니다." };

  const { data, error } = await sb
    .from("member_visits")
    .insert({
      venue_id: venueId,
      venue_session_id: sessionResult.session.id,
      member_id: memberId,
      status: "on_floor",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await sb.from("members").update({ floor_status: "visitor" }).eq("id", memberId);
  return { visitId: data.id };
}

export async function checkOutAllOnFloor(): Promise<{ checkedOut: number } | { error: string }> {
  const onFloor = await listOnFloorToday();
  if ("error" in onFloor) return onFloor;
  for (const guest of onFloor) {
    const result = await checkOutVisit(guest.visitId);
    if ("error" in result) return result;
  }
  return { checkedOut: onFloor.length };
}

export async function checkOutVisit(visitId: string): Promise<{ ok: true } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase에 연결할 수 없습니다." };
  const { data: visit } = await sb.from("member_visits").select("member_id").eq("id", visitId).maybeSingle();
  if (!visit) return { error: "방문 기록을 찾을 수 없습니다." };
  const now = new Date().toISOString();
  const { error } = await sb
    .from("member_visits")
    .update({ status: "left", checked_out_at: now })
    .eq("id", visitId);
  if (error) return { error: error.message };
  await sb.from("members").update({ floor_status: "registered" }).eq("id", visit.member_id);
  return { ok: true };
}
