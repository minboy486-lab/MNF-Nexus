import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { GuestsClient } from "@/components/guests/GuestsClient";
import { getActiveMemberVisits, getPendingApprovals } from "@/lib/data/queries";
import { getPendingStaffRequests } from "@/lib/data/guest-queries";
import { approveRequest } from "@/lib/actions/games";
import { StaffRequestsPanel } from "@/components/guest/StaffRequestsPanel";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const visits = await getActiveMemberVisits();
  const pending = await getPendingApprovals();
  const staffQueue = await getPendingStaffRequests();

  return (
    <>
      <AdminTopBar title="손님 관리" subtitle="방문 중 · 승인 대기" />
      <div className="admin-main flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        <StaffRequestsPanel
          approvals={staffQueue.approvals}
          transfers={staffQueue.transfers}
        />
        <GuestsClient
          visits={visits}
          pending={pending}
          approveAction={approveRequest}
        />
      </div>
    </>
  );
}
