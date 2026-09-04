import { redirect } from "next/navigation";
import { AccountsClient } from "@/components/accounts/AccountsClient";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { assignableRolesFor, canManageAccounts } from "@/lib/auth/roles";
import { getCurrentUserRole } from "@/lib/auth/session";
import {
  getAccountViewerContext,
  listAccounts,
  type AccountRow,
  type AccountViewerContext,
} from "@/lib/actions/accounts";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const role = await getCurrentUserRole();
  if (!canManageAccounts(role)) {
    redirect("/admin/dashboard");
  }

  const configured = isSupabaseAdminConfigured();
  let viewer: AccountViewerContext = {
    role: (role as UserRole) ?? "manager",
    venueIds: [],
    canSeeAllVenues: false,
    assignableRoles: assignableRolesFor(role),
  };
  let accounts: AccountRow[] = [];
  let configError: string | undefined;

  if (configured) {
    const viewerResult = await getAccountViewerContext();
    if ("error" in viewerResult) {
      configError = viewerResult.error;
    } else {
      viewer = viewerResult;
      const listResult = await listAccounts();
      if ("error" in listResult) configError = listResult.error;
      else accounts = listResult.accounts;
    }
  }

  return (
    <>
      <AdminTopBar
        title="계정 관리"
        subtitle="로그인 계정 생성 · 권한 · 비밀번호"
      />
      <AccountsClient
        accounts={accounts}
        configured={configured}
        configError={configError}
        viewer={viewer}
      />
    </>
  );
}
