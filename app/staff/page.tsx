import { StaffHomeClient } from "@/components/staff/StaffHomeClient";
import { getMyStaffHome } from "@/lib/actions/staff";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const home = await getMyStaffHome();
  if ("error" in home) {
    return <p className="p-6 text-on-surface-variant">{home.error}</p>;
  }

  return (
    <StaffHomeClient
      name={home.name}
      loginId={home.loginId}
      working={home.working}
      checkedInAt={home.checkedInAt}
    />
  );
}
