import { StaffAttendanceClient } from "@/components/staff/StaffAttendanceClient";
import { getMyStaffHome } from "@/lib/actions/staff";

export const dynamic = "force-dynamic";

export default async function StaffAttendancePage() {
  const home = await getMyStaffHome();
  if ("error" in home) {
    return <p className="p-6 text-on-surface-variant">{home.error}</p>;
  }

  return (
    <StaffAttendanceClient
      name={home.name}
      working={home.working}
      monthLabel={home.monthLabel}
      monthHours={home.monthHours}
      shifts={home.shifts}
    />
  );
}
