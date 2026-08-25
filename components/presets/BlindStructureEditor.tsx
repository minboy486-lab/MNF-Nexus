"use client";

import { useMemo, useState } from "react";
import type { BlindStructureRow } from "@/lib/types";
import {
  countPlayLevels,
  createDefaultStructure,
  isPauseRow,
  newStructureRowId,
  renumberLevels,
} from "@/lib/presets/structure";
import { numDisplay, parseIntegerFromInput } from "@/lib/utils/numeric-input";

const inputCls =
  "w-full min-w-0 bg-surface-container-low border border-white/10 rounded-md py-1.5 px-2 text-sm tabular-nums text-center focus:border-primary/50 focus:outline-none";

const anteBtnCls =
  "shrink-0 px-1.5 py-1 rounded text-[9px] font-bold border border-white/15 text-on-surface-variant hover:border-primary/40 hover:bg-primary/15 hover:text-primary transition-colors";

const addBtnCls =
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-on-surface-variant hover:bg-white/5 transition-colors";

type Props = {
  rows: BlindStructureRow[];
  onChange: (rows: BlindStructureRow[]) => void;
};

function rowKey(row: BlindStructureRow, index: number): string {
  return row.id ?? `row-${index}`;
}

export function BlindStructureEditor({ rows, onChange }: Props) {
  const activeLevels = useMemo(() => countPlayLevels(rows), [rows]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

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

  function patchPause(index: number, minutes: number) {
    const next = rows.map((row, i) => {
      if (i !== index || !isPauseRow(row)) return row;
      return { ...row, minutes };
    });
    onChange(next);
  }

  function addLevel() {
    const play = rows.filter((r) => r.kind === "level");
    const last = play[play.length - 1];
    const nextLevel: BlindStructureRow = {
      kind: "level",
      id: newStructureRowId(),
      level: (last?.kind === "level" ? last.level : 0) + 1,
      small: last?.kind === "level" ? last.small * 2 : 100,
      big: last?.kind === "level" ? last.big * 2 : 200,
      ante: 0,
      minutes: last?.kind === "level" ? last.minutes || 15 : 15,
    };
    update([...rows, nextLevel]);
  }

  function addBreak() {
    onChange([...rows, { kind: "break", id: newStructureRowId(), minutes: 10 }]);
  }

  function addRegClose() {
    onChange([...rows, { kind: "reg-close", id: newStructureRowId(), minutes: 10 }]);
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

  function moveRow(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
  }

  const levelGrid =
    "grid grid-cols-[1.75rem_2.5rem_minmax(4rem,1fr)_minmax(4rem,1fr)_minmax(7.5rem,1.4fr)_3.5rem_2rem] gap-1 items-center px-2";

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
          <button type="button" onClick={addBreak} className={addBtnCls}>
            <span className="material-symbols-outlined text-base">coffee</span>
            쉬는 시간
          </button>
          <button type="button" onClick={addRegClose} className={addBtnCls}>
            <span className="material-symbols-outlined text-base">lock_clock</span>
            레지 마감
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-surface-container-low/30">
        <div
          className={`${levelGrid} py-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/80 border-b border-white/10`}
        >
          <span />
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

          {rows.map((row, index) => {
            const dragging = dragIndex === index;
            const over = overIndex === index && dragIndex !== null && dragIndex !== index;
            const rowCls = `${dragging ? "opacity-50" : ""} ${over ? "ring-1 ring-inset ring-primary/60 bg-primary/10" : ""}`;

            const handle = (
              <button
                type="button"
                draggable
                aria-label="순서 변경"
                className="p-0.5 rounded text-on-surface-variant/50 hover:text-on-surface-variant cursor-grab active:cursor-grabbing touch-none justify-self-center"
                onDragStart={(e) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(index));
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
              >
                <span className="material-symbols-outlined text-lg leading-none">drag_indicator</span>
              </button>
            );

            const dropProps = {
              onDragOver: (e: React.DragEvent) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverIndex(index);
              },
              onDrop: (e: React.DragEvent) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("text/plain"));
                moveRow(Number.isFinite(from) ? from : (dragIndex ?? -1), index);
                setDragIndex(null);
                setOverIndex(null);
              },
            };

            if (row.kind === "break" || row.kind === "reg-close") {
              const isClose = row.kind === "reg-close";
              return (
                <div
                  key={rowKey(row, index)}
                  className={`flex items-center gap-2 px-2 py-2.5 border-y border-dashed ${
                    isClose
                      ? "bg-primary/5 border-primary/25"
                      : "bg-secondary/5 border-secondary/25"
                  } ${rowCls}`}
                  {...dropProps}
                >
                  {handle}
                  <span
                    className={`material-symbols-outlined text-lg shrink-0 ${
                      isClose ? "text-primary" : "text-secondary"
                    }`}
                  >
                    {isClose ? "lock_clock" : "coffee"}
                  </span>
                  <span className="text-xs font-medium text-on-surface-variant shrink-0">
                    {isClose ? "레지 마감" : "쉬는 시간"}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={numDisplay(row.minutes)}
                    onChange={(e) => patchPause(index, parseIntegerFromInput(e.target.value))}
                    className={`${inputCls} max-w-[4rem]`}
                  />
                  <span className="text-xs text-on-surface-variant">분</span>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="ml-auto p-1 rounded-md text-on-surface-variant/60 hover:text-error hover:bg-error/10"
                    aria-label={isClose ? "레지 마감 삭제" : "쉬는 시간 삭제"}
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              );
            }

            return (
              <div key={rowKey(row, index)} className={`${levelGrid} py-1.5 ${rowCls}`} {...dropProps}>
                {handle}
                <span className="text-center text-xs font-bold text-primary tabular-nums">
                  {row.level}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={numDisplay(row.small)}
                  onChange={(e) =>
                    patchLevel(index, { small: parseIntegerFromInput(e.target.value) })
                  }
                  className={inputCls}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={numDisplay(row.big)}
                  onChange={(e) => patchLevel(index, { big: parseIntegerFromInput(e.target.value) })}
                  className={inputCls}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={numDisplay(row.ante)}
                  placeholder="0"
                  onChange={(e) =>
                    patchLevel(index, { ante: parseIntegerFromInput(e.target.value) })
                  }
                  className={inputCls}
                  aria-label={`레벨 ${row.level} 앤티`}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={numDisplay(row.minutes)}
                  onChange={(e) =>
                    patchLevel(index, { minutes: parseIntegerFromInput(e.target.value) })
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
