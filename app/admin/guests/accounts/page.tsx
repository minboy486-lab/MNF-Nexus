import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { GuestAccountsClient } from "@/components/guests/GuestAccountsClient";
import {
  listGuestAccounts,
  listOrphanGuestProfiles,
} from "@/lib/actions/guest-accounts";
import type { GuestAccountRow } from "@/lib/guest/accounts";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function GuestAccountsPage() {
  const configured = isSupabaseAdminConfigured();

  let accounts: GuestAccountRow[] = [];
  let orphans: { id: string; login_id: string; display_name: string | null }[] = [];
  let configError: string | undefined;

  if (configured) {
    const [accountsResult, orphansResult] = await Promise.all([
      listGuestAccounts(),
      listOrphanGuestProfiles(),
    ]);
    if ("accounts" in accountsResult) {
      accounts = accountsResult.accounts;
    } else {
      configError = accountsResult.error;
    }
    if ("profiles" in orphansResult) {
      orphans = orphansResult.profiles;
    } else if (!configError) {
      configError = orphansResult.error;
    }
  }

  return (
    <>
      <AdminTopBar title="손님 계정 관리" subtitle="로그인 아이디 · 초기 비밀번호 123456" />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-6">
        <GuestAccountsClient
          accounts={accounts}
          orphans={orphans}
          configured={configured}
          configError={configError}
        />
      </div>
    </>
  );
}
