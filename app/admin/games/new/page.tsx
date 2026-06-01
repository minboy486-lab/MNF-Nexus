import { redirect } from "next/navigation";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { getGamePresets, getPhysicalTables } from "@/lib/data/queries";
import { startGame } from "@/lib/actions/games";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
  const presets = await getGamePresets();
  const tables = await getPhysicalTables();

  async function handleStart(formData: FormData) {
    "use server";
    const result = await startGame(formData);
    if (result?.gameId) redirect(`/admin/games/${result.gameId}`);
  }

  return (
    <>
      <AdminTopBar title="게임 개설" subtitle="프리셋 선택 · 물리 테이블 복수 선택" />
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {!isSupabaseConfigured() && (
          <p className="mb-4 text-tertiary text-sm glass-panel p-4 rounded-lg">
            데모 모드: Supabase 연결 후 실제 게임을 개설할 수 있습니다.
          </p>
        )}
        <form action={handleStart} className="glass-panel rounded-xl p-6 space-y-6">
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase" htmlFor="preset_id">
              게임 프리셋 (맵)
            </label>
            <select
              id="preset_id"
              name="preset_id"
              required
              className="w-full mt-2 bg-surface-container-low border border-white/10 rounded-lg py-3 px-4"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase mb-2">
              물리 테이블 (복수 선택 = 동시 송출)
            </p>
            <div className="grid grid-cols-2 gap-3">
              {tables.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant/30 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                >
                  <input
                    type="checkbox"
                    name="physical_table_ids"
                    value={t.id}
                    defaultChecked={t.code === "B"}
                    className="rounded"
                  />
                  <span className="font-bold">테이블 {t.code}</span>
                  {t.current_game_id && (
                    <span className="text-[10px] text-error ml-auto">사용중</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!isSupabaseConfigured()}
            className="btn-primary w-full py-4 rounded-lg"
          >
            게임 시작
          </button>
        </form>
      </div>
    </>
  );
}
