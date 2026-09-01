import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { GuestPointsClient } from "@/components/guests/GuestPointsClient";
import {
  getActiveMemberVisits,
  getMembers,
  getMemberVisitCounts,
} from "@/lib/data/queries";
import { getProfile } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GuestPointsPage() {
  const { profile } = await getProfile();
  if (!isAdminRole(profile?.role)) {
    redirect("/admin/guests/visits");
  }

  const [members, visits, visitCounts] = await Promise.all([
    getMembers(),
    getActiveMemberVisits(),
    getMemberVisitCounts(),
  ]);

  return (
    <>
      <AdminTopBar title="포인트 관리" subtitle="손님 MP 추가·차감" />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-6">
        <GuestPointsClient
          members={members}
          visits={visits}
          visitCounts={visitCounts}
        />
      </div>
    </>
  );
}
