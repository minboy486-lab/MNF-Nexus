import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { getGamePresets } from "@/lib/data/queries";
import { createPreset } from "@/lib/actions/games";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function savePreset(formData: FormData) {
  "use server";
  await createPreset(formData);
  revalidatePath("/admin/presets");
}

const DEFAULT_STRUCTURE = `[
  {"level":1,"small":100,"big":200,"ante":0,"minutes":20},
  {"level":2,"small":200,"big":400,"ante":0,"minutes":20},
  {"level":3,"small":300,"big":600,"ante":600,"minutes":20}
]`;

export default async function PresetsPage() {
  const presets = await getGamePresets();

  return (
    <>
      <AdminTopBar title="게임 프리셋" subtitle="블라인드 · 바이인 (프라이즈 추후)" />
      <div className="flex-1 overflow-y-auto p-6 grid lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h2 className="font-bold">저장된 프리셋</h2>
          {presets.map((p) => (
            <div key={p.id} className="glass-panel rounded-xl p-5 border border-outline-variant/20">
              <h3 className="font-bold text-primary">{p.name}</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                바이인 {p.buy_in.toLocaleString("ko-KR")} · 레벨{" "}
                {(p.blind_structure as unknown[]).length}단
              </p>
            </div>
          ))}
        </section>

        <section className="glass-panel rounded-xl p-6">
          <h2 className="font-bold mb-4">새 프리셋</h2>
          <form action={savePreset} className="space-y-4">
            <div>
              <label className="text-xs text-on-surface-variant uppercase" htmlFor="name">
                이름
              </label>
              <input
                id="name"
                name="name"
                required
                className="w-full mt-1 bg-surface-container-low border border-white/10 rounded-lg py-2 px-3"
                placeholder="데일리 기본"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant uppercase" htmlFor="buy_in">
                바이인
              </label>
              <input
                id="buy_in"
                name="buy_in"
                type="number"
                defaultValue={500000}
                className="w-full mt-1 bg-surface-container-low border border-white/10 rounded-lg py-2 px-3"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant uppercase" htmlFor="blind_structure">
                블라인드 구조 (JSON)
              </label>
              <textarea
                id="blind_structure"
                name="blind_structure"
                rows={8}
                defaultValue={DEFAULT_STRUCTURE}
                className="w-full mt-1 bg-surface-container-low border border-white/10 rounded-lg py-2 px-3 font-mono text-xs"
              />
            </div>
            <button type="submit" className="btn-primary w-full py-3 rounded-lg">
              저장
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
