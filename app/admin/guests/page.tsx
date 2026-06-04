import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { GuestsClient } from "@/components/guests/GuestsClient";
import {
  getActiveMemberVisits,
  getActiveVisitMemberIds,
  getMembers,
  getMemberVisitCounts,
  getPendingApprovals,
} from "@/lib/data/queries";
import { getPendingStaffRequests } from "@/lib/data/guest-queries";
import { approveRequest } from "@/lib/actions/games";
import { StaffRequestsPanel } from "@/components/guest/StaffRequestsPanel";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const [visits, members, pending, staffQueue, visitingIds, visitCounts] =
    await Promise.all([
      getActiveMemberVisits(),
      getMembers(),
      getPendingApprovals(),
      getPendingStaffRequests(),
      getActiveVisitMemberIds(),
      getMemberVisitCounts(),
    ]);

  return (
    <>
      <AdminTopBar title="손님 관리" subtitle="전체 손님 ↔ 방문 중" />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-6 gap-3">
        <StaffRequestsPanel
          approvals={staffQueue.approvals}
          transfers={staffQueue.transfers}
        />
        <GuestsClient
          members={members}
          visits={visits}
          visitingMemberIds={[...visitingIds]}
          visitCounts={visitCounts}
          pending={pending}
          approveAction={approveRequest}
        />
      </div>
    </>
  );
}
