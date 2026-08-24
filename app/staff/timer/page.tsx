import { StaffTimerGate } from "@/components/staff/StaffTimerGate";
import { getMyStaffHome } from "@/lib/actions/staff";

export const dynamic = "force-dynamic";

export default async function StaffTimerPage() {
  const home = await getMyStaffHome();
  if ("error" in home) {
    return <p className="p-6 text-on-surface-variant">{home.error}</p>;
  }

  return <StaffTimerGate loginId={home.loginId} />;
}
