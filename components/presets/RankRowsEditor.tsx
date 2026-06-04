"use client";

import { NumericInput } from "@/components/ui/NumericInput";
import { renumberRanks } from "@/lib/presets/preset-form";

const inputCls =
  "flex-1 bg-surface-container-low border border-white/10 rounded-lg py-2 px-3 text-sm tabular-nums text-center focus:border-primary/40 focus:outline-none";

type PrizeRow = { rank: number; percent: number };
type WinRow = { rank: number; points: number };

type PrizeProps = {
  mode: "prize";
  rows: PrizeRow[];
  onChange: (rows: PrizeRow[]) => void;
  addLabel?: string;
};

type WinProps = {
  mode: "win";
  rows: WinRow[];
  onChange: (rows: WinRow[]) => void;
  addLabel?: string;
};

type Props = PrizeProps | WinProps;

export function RankRowsEditor(props: Props) {
  const addLabel = props.addLabel ?? "등수 추가";

  function addRow() {
    if (props.mode === "prize") {
      const next = [...props.rows, { rank: props.rows.length + 1, percent: 0 }];
      props.onChange(renumberRanks(next));
    } else {
      const next = [...props.rows, { rank: props.rows.length + 1, points: 0 }];
      props.onChange(renumberRanks(next));
    }
  }

  function removeAt(index: number) {
    if (props.mode === "prize") {
      if (props.rows.length <= 1) return;
      props.onChange(renumberRanks(props.rows.filter((_, i) => i !== index)));
    } else {
      if (props.rows.length <= 1) return;
      props.onChange(renumberRanks(props.rows.filter((_, i) => i !== index)));
    }
  }

  const rows = props.rows;

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-white/15 bg-surface-container-high text-sm font-bold tabular-nums"
            aria-hidden
          >
            {row.rank}
          </span>
          {props.mode === "prize" ? (
            <>
              <NumericInput
                mode="decimal"
                max={100}
                value={(row as PrizeRow).percent}
                onChange={(percent) => {
                  const next = (props.rows as PrizeRow[]).map((r, j) =>
                    j === i ? { ...r, percent } : r,
                  );
                  props.onChange(next);
                }}
                className={inputCls}
                aria-label={`${row.rank}등 비율`}
              />
              <span className="text-xs text-on-surface-variant shrink-0 w-4">%</span>
            </>
          ) : (
            <>
              <NumericInput
                value={(row as WinRow).points}
                onChange={(points) => {
                  const next = (props.rows as WinRow[]).map((r, j) =>
                    j === i ? { ...r, points } : r,
                  );
                  props.onChange(next);
                }}
                className={inputCls}
                aria-label={`${row.rank}등 승점`}
              />
              <span className="text-xs text-on-surface-variant shrink-0 w-4">점</span>
            </>
          )}
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="p-1.5 rounded-md text-on-surface-variant/60 hover:text-error shrink-0"
              aria-label="등수 삭제"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <span className="material-symbols-outlined text-base">add</span>
        {addLabel}
      </button>
    </div>
  );
}
