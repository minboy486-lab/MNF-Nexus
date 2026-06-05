import type { IntegratedTableItem } from "@/lib/tables/integrated-table";
import type { MemberVisitWithMember, Seat } from "@/lib/types";

/** 현재 어떤 좌석에든 앉아 있는 member_id */
export function collectSeatedMemberIds(seats: Pick<Seat, "member_id">[]): Set<string> {
  const ids = new Set<string>();
  for (const seat of seats) {
    if (seat.member_id) ids.add(seat.member_id);
  }
  return ids;
}

export function collectSeatedMemberIdsFromTables(tables: IntegratedTableItem[]): Set<string> {
  const ids = new Set<string>();
  for (const table of tables) {
    if (!table.hasGame) continue;
    for (const seat of table.seats) {
      if (seat.member_id) ids.add(seat.member_id);
    }
  }
  return ids;
}

/** 좌석 배정 가능한 방문 중 손님 (게임 중 손님 제외) */
export function filterAssignableVisits(
  visits: MemberVisitWithMember[],
  seatedMemberIds: Set<string>,
): MemberVisitWithMember[] {
  return visits.filter(
    (v) => !seatedMemberIds.has(v.member_id) && v.members?.floor_status !== "in_game",
  );
}
