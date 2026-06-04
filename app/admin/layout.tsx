import { AdminShell } from "@/components/admin/AdminShell";
import { canManageAccounts } from "@/lib/auth/roles";
import { getCurrentUserRole } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewerRole = await getCurrentUserRole();
  const showAccountLink = canManageAccounts(viewerRole);
  return (
    <AdminShell showAccountLink={showAccountLink}>{children}</AdminShell>
  );
}
