import { StaffShell } from "@/components/staff/StaffShell";
import { getMyStaffHome } from "@/lib/actions/staff";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const home = await getMyStaffHome();
  const working = !("error" in home) && home.working;

  return <StaffShell working={working}>{children}</StaffShell>;
}
