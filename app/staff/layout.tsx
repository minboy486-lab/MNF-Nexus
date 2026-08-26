import { StaffShell } from "@/components/staff/StaffShell";
import { VenueProvider } from "@/components/venue/VenueContext";
import { getMyStaffHome } from "@/lib/actions/staff";
import { getActiveVenueId, listAccessibleVenues } from "@/lib/venue/active";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const [home, venues, activeVenueId] = await Promise.all([
    getMyStaffHome(),
    listAccessibleVenues(),
    getActiveVenueId(),
  ]);
  const working = !("error" in home) && home.working;

  return (
    <VenueProvider venues={venues} activeVenueId={activeVenueId}>
      <StaffShell working={working}>{children}</StaffShell>
    </VenueProvider>
  );
}
