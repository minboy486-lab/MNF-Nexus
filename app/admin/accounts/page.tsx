import { redirect } from "next/navigation";
import { AccountsClient } from "@/components/accounts/AccountsClient";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { canManageAccounts } from "@/lib/auth/roles";
import { getCurrentUserRole } from "@/lib/auth/session";
import { listAccounts, type AccountRow } from "@/lib/actions/accounts";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const role = await getCurrentUserRole();
  if (!canManageAccounts(role)) {
    redirect("/admin/dashboard");
  }

  const configured = isSupabaseAdminConfigured();
  const listResult = configured ? await listAccounts() : null;
  const accounts: AccountRow[] =
    listResult && "accounts" in listResult ? listResult.accounts : [];
  const configError =
    listResult && "error" in listResult ? listResult.error : undefined;

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
      />
    </>
  );
}
