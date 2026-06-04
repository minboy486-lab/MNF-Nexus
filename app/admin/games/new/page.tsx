import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { NewGamePageClient } from "@/components/games/NewGamePageClient";
import { getGamePresets, getPhysicalTables } from "@/lib/data/queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
  const presets = await getGamePresets();
  const tables = await getPhysicalTables();

  return (
    <>
      <AdminTopBar title="게임 개설" subtitle="블라인드 선택 · 물리 테이블 복수 선택" />
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {!isSupabaseConfigured() && (
          <p className="mb-4 text-tertiary text-sm glass-panel p-4 rounded-lg">
            데모 모드: Supabase 연결 후 실제 게임을 개설할 수 있습니다.
          </p>
        )}
        <div className="glass-panel rounded-xl p-6">
          <NewGamePageClient presets={presets} tables={tables} />
        </div>
      </div>
    </>
  );
}
