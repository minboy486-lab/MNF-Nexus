import { AdminShell } from "@/components/admin/AdminShell";
import { canManageAccounts, getAdminHomePath, getAdminNavAccess } from "@/lib/auth/roles";
import { getCurrentUserRole } from "@/lib/auth/session";
import { getActiveVenueId, listAccessibleVenues } from "@/lib/venue/active";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewerRole = await getCurrentUserRole();
  const navAccess = getAdminNavAccess(viewerRole);
  const showAccountLink = canManageAccounts(viewerRole);
  const [venues, activeVenueId] = await Promise.all([
    listAccessibleVenues(),
    getActiveVenueId(),
  ]);
  const homeHref = getAdminHomePath(viewerRole, activeVenueId);
  return (
    <AdminShell
      showAccountLink={showAccountLink}
      navAccess={navAccess}
      homeHref={homeHref}
      venues={venues}
      activeVenueId={activeVenueId}
    >
      {children}
    </AdminShell>
  );
}
