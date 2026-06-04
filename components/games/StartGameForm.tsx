"use client";

import { useMemo, useState } from "react";
import { startGameFromSelection } from "@/lib/actions/games";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { GamePreset, PhysicalTable } from "@/lib/types";

const selectCls =
  "w-full mt-2 bg-surface-container-low border border-white/10 rounded-lg py-3 px-4 text-sm focus:border-primary/40 focus:outline-none";
const checkCls =
  "w-5 h-5 shrink-0 rounded border-white/25 bg-surface-container-low accent-primary cursor-pointer";

type Props = {
  presets: GamePreset[];
  tables: PhysicalTable[];
  /** 처음 체크할 테이블 (통합 뷰에서 + 누른 테이블) */
  initialTableId?: string;
  onSuccess?: (gameId: string) => void;
  onCancel?: () => void;
  showCancel?: boolean;
};

export function StartGameForm({
  presets,
  tables,
  initialTableId,
  onSuccess,
  onCancel,
  showCancel,
}: Props) {
  const available = useMemo(
    () => tables.filter((t) => !t.current_game_id),
    [tables],
  );
  const defaultPresetId = presets[0]?.id ?? "";
  const defaultTableIds = useMemo(() => {
    if (initialTableId && available.some((t) => t.id === initialTableId)) {
      return [initialTableId];
    }
    const b = available.find((t) => t.code === "B");
    return b ? [b.id] : available[0] ? [available[0].id] : [];
  }, [available, initialTableId]);

  const [presetId, setPresetId] = useState(defaultPresetId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(defaultTableIds),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTable(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setError("Supabase가 연결되지 않았습니다.");
      return;
    }
    if (!presetId) {
      setError("블라인드를 선택하세요.");
      return;
    }
    if (selectedIds.size === 0) {
      setError("테이블을 1개 이상 선택하세요.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await startGameFromSelection({
      presetId,
      physicalTableIds: [...selectedIds],
    });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onSuccess?.(result.gameId);
  }

  const sortedTables = useMemo(
    () => [...tables].sort((a, b) => a.code.localeCompare(b.code)),
    [tables],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          className="text-xs font-semibold text-on-surface-variant uppercase"
          htmlFor="start-game-preset"
        >
          블라인드 (맵)
        </label>
        <select
          id="start-game-preset"
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          required
          className={selectCls}
        >
          {presets.length === 0 ? (
            <option value="">블라인드 없음</option>
          ) : (
            presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold text-on-surface-variant uppercase mb-2">
          물리 테이블 (복수 선택 = 동시 송출)
        </p>
        <div className="grid grid-cols-2 gap-3">
          {sortedTables.map((t) => {
            const inUse = Boolean(t.current_game_id);
            if (inUse) {
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-surface-container-low/30 opacity-70"
                >
                  <span className="font-bold">테이블 {t.code}</span>
                  <span className="text-[10px] text-error ml-auto font-semibold">사용중</span>
                </div>
              );
            }
            const checked = selectedIds.has(t.id);
            return (
              <label
                key={t.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checked
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant/30 hover:border-primary/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTable(t.id)}
                  className={checkCls}
                />
                <span className="font-bold">테이블 {t.code}</span>
              </label>
            );
          })}
        </div>
        {available.length === 0 && (
          <p className="text-xs text-error mt-2">선택 가능한 테이블이 없습니다.</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className={showCancel ? "flex gap-3" : ""}>
        {showCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 rounded-lg border border-white/15 text-sm font-medium hover:bg-white/5"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={!isSupabaseConfigured() || pending || presets.length === 0}
          className={`btn-primary py-4 rounded-lg text-sm font-semibold disabled:opacity-50 ${
            showCancel ? "flex-1" : "w-full"
          }`}
        >
          {pending ? "시작 중…" : "게임 시작"}
        </button>
      </div>
    </form>
  );
}
