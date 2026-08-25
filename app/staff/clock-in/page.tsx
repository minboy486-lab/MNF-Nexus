import { StaffClockInClient } from "@/components/staff/StaffClockInClient";
import { getMyStaffHome } from "@/lib/actions/staff";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StaffClockInPage() {
  const home = await getMyStaffHome();
  if ("error" in home) {
    return <p className="p-6 text-on-surface-variant">{home.error}</p>;
  }
  if (home.working) redirect("/staff");

  return <StaffClockInClient loginId={home.loginId} />;
}
