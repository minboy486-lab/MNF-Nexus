"use client";

import { NumericInput } from "@/components/ui/NumericInput";
import type { RebuyChipTier } from "@/lib/types";

const inputCls =
  "flex-1 bg-surface-container-low border border-white/10 rounded-lg py-2 px-3 text-sm tabular-nums text-center focus:border-primary/40 focus:outline-none";

function renumberOrders(rows: RebuyChipTier[]): RebuyChipTier[] {
  return rows.map((row, i) => ({ ...row, order: i + 1 }));
}

type Props = {
  rows: RebuyChipTier[];
  onChange: (rows: RebuyChipTier[]) => void;
};

export function RebuyChipsEditor({ rows, onChange }: Props) {
  function addTier() {
    const last = rows[rows.length - 1];
    onChange(
      renumberOrders([
        ...rows,
        { order: rows.length + 1, chips: last?.chips ?? 0 },
      ]),
    );
  }

  function removeAt(index: number) {
    if (rows.length <= 1) return;
    onChange(renumberOrders(rows.filter((_, i) => i !== index)));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-white/15 bg-surface-container-high text-sm font-bold tabular-nums"
            aria-hidden
          >
            {row.order}
          </span>
          <span className="text-xs text-on-surface-variant shrink-0 w-14">차 리바인</span>
          <NumericInput
            value={row.chips}
            onChange={(chips) => {
              onChange(rows.map((r, j) => (j === i ? { ...r, chips } : r)));
            }}
            className={inputCls}
            aria-label={`${row.order}차 리바인 칩`}
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="p-1.5 rounded-md text-on-surface-variant/60 hover:text-error shrink-0"
              aria-label={`${row.order}차 삭제`}
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addTier}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <span className="material-symbols-outlined text-base">add</span>
        리바인 칩 추가
      </button>
    </div>
  );
}
