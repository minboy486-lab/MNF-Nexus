"use client";

import { useMemo } from "react";
import type { BlindStructureRow } from "@/lib/types";
import {
  countPlayLevels,
  createDefaultStructure,
  renumberLevels,
} from "@/lib/presets/structure";
import { numDisplay, parseNumInput } from "@/lib/utils/numeric-input";

const inputCls =
  "w-full min-w-0 bg-surface-container-low border border-white/10 rounded-md py-1.5 px-2 text-sm tabular-nums text-center focus:border-primary/50 focus:outline-none";

const anteBtnCls =
  "shrink-0 px-1.5 py-1 rounded text-[9px] font-bold border border-white/15 text-on-surface-variant hover:border-primary/40 hover:bg-primary/15 hover:text-primary transition-colors";

type Props = {
  rows: BlindStructureRow[];
  onChange: (rows: BlindStructureRow[]) => void;
};

export function BlindStructureEditor({ rows, onChange }: Props) {
  const activeLevels = useMemo(() => countPlayLevels(rows), [rows]);

  function update(next: BlindStructureRow[]) {
    onChange(renumberLevels(next));
  }

  function patchLevel(index: number, patch: Partial<Extract<BlindStructureRow, { kind: "level" }>>) {
    const next = rows.map((row, i) => {
      if (i !== index || row.kind !== "level") return row;
      return { ...row, ...patch };
    });
    update(next);
  }

  function patchBreak(index: number, minutes: number) {
    const next = rows.map((row, i) => {
      if (i !== index || row.kind !== "break") return row;
      return { ...row, minutes };
    });
    onChange(next);
  }

  function addLevel() {
    const play = rows.filter((r) => r.kind === "level");
    const last = play[play.length - 1];
    const nextLevel: BlindStructureRow = {
      kind: "level",
      level: (last?.kind === "level" ? last.level : 0) + 1,
      small: last?.kind === "level" ? last.small * 2 : 100,
      big: last?.kind === "level" ? last.big * 2 : 200,
      ante: 0,
      minutes: last?.kind === "level" ? last.minutes : 15,
    };
    update([...rows, nextLevel]);
  }

  function addBreak() {
    onChange([...rows, { kind: "break", minutes: 10 }]);
  }

  function removeAt(index: number) {
    update(rows.filter((_, i) => i !== index));
  }

  function resetDefaults() {
    onChange(createDefaultStructure());
  }

  function applyAnteBulk(mode: "sb" | "bb") {
    onChange(
      rows.map((row) => {
        if (row.kind !== "level") return row;
        return { ...row, ante: mode === "sb" ? row.small : row.big };
      }),
    );
  }

  const levelGrid =
    "grid grid-cols-[2.5rem_minmax(4rem,1fr)_minmax(4rem,1fr)_minmax(7.5rem,1.4fr)_3.5rem_2rem] gap-1 items-center px-2";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-on-surface-variant">
          <span className="text-primary font-semibold tabular-nums">{activeLevels}</span> 레벨
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addLevel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            <span className="material-symbols-outlined text-base">add</span>
            레벨 추가
          </button>
          <button
            type="button"
            onClick={addBreak}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-on-surface-variant hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-base">coffee</span>
            쉬는 시간
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-surface-container-low/30">
        <div
          className={`${levelGrid} py-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/80 border-b border-white/10`}
        >
          <span className="text-center">Lv</span>
          <span className="text-center">SB</span>
          <span className="text-center">BB</span>
          <div className="flex items-center justify-center gap-0.5 min-w-0">
            <span className="shrink-0">Ante</span>
            <button
              type="button"
              className={anteBtnCls}
              title="모든 레벨 앤티 = SB"
              onClick={() => applyAnteBulk("sb")}
            >
              SB
            </button>
            <button
              type="button"
              className={anteBtnCls}
              title="모든 레벨 앤티 = BB"
              onClick={() => applyAnteBulk("bb")}
            >
              BB
            </button>
          </div>
          <span className="text-center">분</span>
          <span />
        </div>

        <div className="divide-y divide-white/5 max-h-[min(50vh,420px)] overflow-y-auto">
          {rows.length === 0 && (
            <div className="p-6 text-center text-sm text-on-surface-variant">
              레벨이 없습니다.{" "}
              <button type="button" onClick={resetDefaults} className="text-primary underline">
                기본 구조 불러오기
              </button>
            </div>
          )}

          {rows.map((row, index) =>
            row.kind === "break" ? (
              <div
                key={`break-${index}`}
                className="flex items-center gap-2 px-3 py-2.5 bg-secondary/5 border-y border-dashed border-secondary/25"
              >
                <span className="material-symbols-outlined text-secondary text-lg shrink-0">
                  coffee
                </span>
                <span className="text-xs font-medium text-on-surface-variant shrink-0">
                  쉬는 시간
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={numDisplay(row.minutes)}
                  onChange={(e) => patchBreak(index, parseNumInput(e.target.value, 10) || 1)}
                  className={`${inputCls} max-w-[4rem]`}
                />
                <span className="text-xs text-on-surface-variant">분</span>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="ml-auto p-1 rounded-md text-on-surface-variant/60 hover:text-error hover:bg-error/10"
                  aria-label="쉬는 시간 삭제"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            ) : (
              <div key={`level-${index}`} className={`${levelGrid} py-1.5`}>
                <span className="text-center text-xs font-bold text-primary tabular-nums">
                  {row.level}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={numDisplay(row.small)}
                  onChange={(e) =>
                    patchLevel(index, { small: parseNumInput(e.target.value, 0) })
                  }
                  className={inputCls}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={numDisplay(row.big)}
                  onChange={(e) => patchLevel(index, { big: parseNumInput(e.target.value, 0) })}
                  className={inputCls}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={numDisplay(row.ante)}
                  placeholder="0"
                  onChange={(e) =>
                    patchLevel(index, { ante: parseNumInput(e.target.value, 0) })
                  }
                  className={inputCls}
                  aria-label={`레벨 ${row.level} 앤티`}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={numDisplay(row.minutes)}
                  onChange={(e) =>
                    patchLevel(index, { minutes: parseNumInput(e.target.value, 15) || 1 })
                  }
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="p-1 rounded-md text-on-surface-variant/60 hover:text-error hover:bg-error/10 justify-self-center"
                  aria-label={`레벨 ${row.level} 삭제`}
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
