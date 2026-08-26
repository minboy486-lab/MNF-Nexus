import { AdminShell } from "@/components/admin/AdminShell";
import { canManageAccounts } from "@/lib/auth/roles";
import { getCurrentUserRole } from "@/lib/auth/session";
import { getActiveVenueId, listAccessibleVenues } from "@/lib/venue/active";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewerRole = await getCurrentUserRole();
  const showAccountLink = canManageAccounts(viewerRole);
  const [venues, activeVenueId] = await Promise.all([
    listAccessibleVenues(),
    getActiveVenueId(),
  ]);
  return (
    <AdminShell
      showAccountLink={showAccountLink}
      venues={venues}
      activeVenueId={activeVenueId}
    >
      {children}
    </AdminShell>
  );
}
