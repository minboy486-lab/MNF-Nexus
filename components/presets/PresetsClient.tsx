"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { PresetDetailPanel } from "@/components/presets/PresetDetailPanel";
import { PresetFormModal } from "@/components/presets/PresetFormModal";
import { deletePreset } from "@/lib/actions/games";
import { countPlayLevels, normalizeStructure } from "@/lib/presets/structure";
import { formatMp } from "@/lib/utils/mp";
import type { GamePreset } from "@/lib/types";

type Props = {
  presets: GamePreset[];
};

type ModalMode = "create" | "edit" | null;

function kindLabel(kind: GamePreset["game_kind"]) {
  return kind === "tournament" ? "대회" : "데일리";
}

export function PresetsClient({ presets }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [deletePending, setDeletePending] = useState(false);

  const showDetail = selectedId !== null;

  const selected = useMemo(
    () => presets.find((p) => p.id === selectedId) ?? null,
    [presets, selectedId],
  );

  function toggleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`「${selected.name}」 블라인드를 삭제할까요?`)) return;
    setDeletePending(true);
    const res = await deletePreset(selected.id);
    setDeletePending(false);
    if (res.error) {
      alert(res.error);
      return;
    }
    setSelectedId(null);
    router.refresh();
  }

  return (
    <>
      <AdminTopBar title="블라인드" subtitle="맵 · 바이인 · 프라이즈">
        <button
          type="button"
          onClick={() => setModalMode("create")}
          className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold shadow-[0_0_24px_var(--glow-pink)]"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          블라인드 생성
        </button>
      </AdminTopBar>

      <div
        className={`flex-1 flex min-h-0 overflow-hidden ${
          showDetail ? "" : "justify-start"
        }`}
      >
        <aside
          className={`shrink-0 overflow-y-auto transition-[width] ${
            showDetail
              ? "w-64 sm:w-72 border-r border-white/10 p-3 sm:p-4"
              : "w-full max-w-2xl ml-4 sm:ml-6 md:ml-8 p-4 sm:p-6"
          }`}
        >
          {presets.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-12 text-center">
              저장된 블라인드가 없습니다.
            </p>
          ) : (
            <ul className={showDetail ? "space-y-1" : "space-y-2"}>
              {presets.map((p) => {
                const levels = countPlayLevels(normalizeStructure(p.blind_structure));
                const kind = p.game_kind ?? "daily";
                const active = p.id === selectedId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(p.id)}
                      className={`w-full flex items-center gap-3 rounded-xl border text-left transition-colors ${
                        showDetail ? "px-3 py-2.5" : "px-4 py-3.5 sm:px-5 sm:py-4"
                      } ${
                        active
                          ? "border-primary bg-primary/15 ring-1 ring-primary/30"
                          : "border-white/8 bg-surface-container-low/40 hover:border-primary/25 hover:bg-primary/5"
                      }`}
                    >
                      <span
                        className={`shrink-0 font-bold uppercase rounded ${
                          showDetail
                            ? "text-[10px] px-1.5 py-0.5"
                            : "text-xs px-2 py-1"
                        } ${
                          kind === "tournament"
                            ? "bg-secondary/20 text-secondary"
                            : "bg-primary/15 text-primary"
                        }`}
                      >
                        {kindLabel(kind)}
                      </span>
                      <span
                        className={`font-medium truncate flex-1 min-w-0 ${
                          showDetail ? "text-sm" : "text-base sm:text-lg"
                        }`}
                      >
                        {p.name}
                      </span>
                      <span
                        className={`text-on-surface-variant tabular-nums shrink-0 ${
                          showDetail ? "text-[10px]" : "text-xs sm:text-sm"
                        }`}
                      >
                        바인 {formatMp(p.buy_in)} · {levels}레벨
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {showDetail && selected && (
          <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-5">
            <div className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6 w-full min-h-full">
              <PresetDetailPanel
                preset={selected}
                onEdit={() => setModalMode("edit")}
                onDelete={handleDelete}
                deletePending={deletePending}
              />
            </div>
          </main>
        )}
      </div>

      {modalMode === "create" && (
        <PresetFormModal
          onClose={() => setModalMode(null)}
          onSaved={(id) => {
            setSelectedId(id);
            setModalMode(null);
          }}
        />
      )}
      {modalMode === "edit" && selected && (
        <PresetFormModal
          key={selected.id}
          preset={selected}
          onClose={() => setModalMode(null)}
          onSaved={() => setModalMode(null)}
        />
      )}
    </>
  );
}
