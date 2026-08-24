import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { StaffClient } from "@/components/staff/StaffClient";
import { getStaffList, getStaffPayrollSummary } from "@/lib/actions/staff";
import { isManagerOrAdmin } from "@/lib/auth/roles";
import { getCurrentUserRole } from "@/lib/auth/session";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const staff = isSupabaseConfigured() ? await getStaffList() : [];
  const payroll = isSupabaseConfigured()
    ? await getStaffPayrollSummary(yearMonth)
    : { staff: [], period: null };
  const role = await getCurrentUserRole();

  return (
    <>
      <AdminTopBar title="직원 · 급여" subtitle="계정 · 출퇴근 · 가불 · 시급" />
      <div className="admin-main flex-1 overflow-y-auto p-6 md:p-8">
        <StaffClient
          staff={staff}
          payrollLines={payroll.staff}
          configured={isSupabaseConfigured()}
          canCreate={isManagerOrAdmin(role)}
          adminConfigured={isSupabaseAdminConfigured()}
        />
      </div>
    </>
  );
}
