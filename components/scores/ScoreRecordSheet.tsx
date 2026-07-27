"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addManualScoresBatch } from "@/lib/actions/manual-scores-batch";
import { deleteManualScore } from "@/lib/actions/manual-scores";
import type { ManualScoreDaily, MemberSuggestion } from "@/lib/scores/types";

const LAST_DATE_KEY = "mnf-score-last-date";
const EMPTY_ROW_COUNT = 12;

type DraftRow = {
  id: string;
  nickname: string;
  buyIn: string;
  rebuy: string;
  moneyIn: string;
};

type Props = {
  members: MemberSuggestion[];
  savedRows: ManualScoreDaily[];
  initialDate: string;
  periodFrom: string;
  periodTo: string;
  hasDateInUrl: boolean;
};

function formatDateKo(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

function emptyRow(): DraftRow {
  return {
    id: crypto.randomUUID(),
    nickname: "",
    buyIn: "",
    rebuy: "",
    moneyIn: "",
  };
}

function freshDraftRows(): DraftRow[] {
  return Array.from({ length: EMPTY_ROW_COUNT }, () => emptyRow());
}

export function ScoreRecordSheet({
  members,
  savedRows,
  initialDate,
  periodFrom,
  periodTo,
  hasDateInUrl,
}: Props) {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [playDate, setPlayDate] = useState(initialDate);
  const [draftRows, setDraftRows] = useState<DraftRow[]>(() => freshDraftRows());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memberNames = useMemo(
    () => members.map((m) => m.nickname),
    [members],
  );

  useEffect(() => {
    if (hasDateInUrl) return;
    const saved = localStorage.getItem(LAST_DATE_KEY);
    if (saved && saved !== initialDate) {
      router.replace(`/admin/scores?date=${saved}&from=${periodFrom}&to=${periodTo}`);
    }
  }, [hasDateInUrl, initialDate, periodFrom, periodTo, router]);

  useEffect(() => {
    setPlayDate(initialDate);
    setMessage(null);
    setError(null);
  }, [initialDate]);

  const navigateDate = useCallback(
    (date: string) => {
      localStorage.setItem(LAST_DATE_KEY, date);
      setPlayDate(date);
      router.push(`/admin/scores?date=${date}&from=${periodFrom}&to=${periodTo}`);
    },
    [periodFrom, periodTo, router],
  );

  function updateDraft(id: string, patch: Partial<DraftRow>) {
    setDraftRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addMoreRows() {
    setDraftRows((rows) => [...rows, ...freshDraftRows().slice(0, 5)]);
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    setMessage(null);

    const payload = draftRows
      .filter((r) => r.nickname.trim())
      .map((r) => ({
        playDate,
        nickname: r.nickname.trim(),
        buyInPoints: Number(r.buyIn) || 0,
        rebuyPoints: Number(r.rebuy) || 0,
        moneyInPoints: Number(r.moneyIn) || 0,
      }));

    const result = await addManualScoresBatch(payload);
    setPending(false);

    if ("error" in result && result.error) {
      setError(result.error);
      if (result.saved && result.saved > 0) router.refresh();
      return;
    }

    localStorage.setItem(LAST_DATE_KEY, playDate);
    setDraftRows(freshDraftRows());
    setMessage(
      result.anyMemberCreated
        ? `${result.saved}명 기록 저장 (신규 손님 포함)`
        : `${result.saved}명 기록 저장`,
    );
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 행을 삭제할까요?")) return;
    setPending(true);
    const result = await deleteManualScore(id);
    setPending(false);
    if ("error" in result && result.error) alert(result.error);
    else router.refresh();
  }

  function handleKeyDown(
    e: React.KeyboardEvent,
    rowIndex: number,
    col: "nickname" | "buyIn" | "rebuy" | "moneyIn",
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      const cols: ("nickname" | "buyIn" | "rebuy" | "moneyIn")[] = [
        "nickname",
        "buyIn",
        "rebuy",
        "moneyIn",
      ];
      const colIdx = cols.indexOf(col);
      const nextCol = cols[colIdx + 1];
      if (nextCol) {
        const el = document.querySelector<HTMLInputElement>(
          `[data-row="${rowIndex}"][data-col="${nextCol}"]`,
        );
        el?.focus();
        el?.select();
      } else if (rowIndex < draftRows.length - 1) {
        const el = document.querySelector<HTMLInputElement>(
          `[data-row="${rowIndex + 1}"][data-col="nickname"]`,
        );
        el?.focus();
      } else {
        void handleSave();
      }
    }
  }

  const dayTotal = savedRows.reduce(
    (sum, r) => sum + r.buy_in_points + r.rebuy_points + r.money_in_points,
    0,
  );

  return (
    <section className="glass-panel rounded-xl flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-white/10 shrink-0">
        <p className="text-[11px] text-on-surface-variant">
          같은 날·닉네임은 합쳐져 점수 누적 · 출석은 날짜당 1회
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">
            저장 {savedRows.length}명 · 합계{" "}
            <span className="text-primary font-bold">{dayTotal}</span>
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "저장 중…" : "입력 저장"}
          </button>
        </div>
      </div>

      {(error || message) && (
        <div
          className={`shrink-0 px-4 py-2 text-xs border-b ${
            error
              ? "text-error bg-error/10 border-error/20"
              : "text-primary bg-primary/10 border-primary/20"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="score-record-sheet w-full border-collapse text-sm min-w-[480px]">
          <thead>
            <tr className="score-sheet-date-row">
              <th colSpan={4} className="text-left py-2 px-3 border border-white/20 bg-[#1a1820]">
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  className="group inline-flex items-center gap-2"
                >
                  <span className="text-lg font-bold text-error group-hover:underline">
                    {formatDateKo(playDate)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">날짜 변경</span>
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={playDate}
                  onChange={(e) => navigateDate(e.target.value)}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="날짜"
                />
              </th>
            </tr>
            <tr className="score-sheet-header-row">
              <th className="score-sheet-th w-[38%]">닉네임</th>
              <th className="score-sheet-th w-[18%]">바이인</th>
              <th className="score-sheet-th w-[18%]">리바인</th>
              <th className="score-sheet-th w-[18%]">머니인</th>
            </tr>
          </thead>
          <tbody>
            {savedRows.map((row) => (
              <tr key={row.id} className="score-sheet-saved-row">
                <td className="score-sheet-td font-semibold">
                  <div className="flex items-center justify-between gap-1">
                    <span>{row.nickname}</span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(row.id)}
                      className="text-error/60 hover:text-error text-xs shrink-0"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  </div>
                </td>
                <td className="score-sheet-td tabular-nums text-right">{row.buy_in_points || ""}</td>
                <td className="score-sheet-td tabular-nums text-right">{row.rebuy_points || ""}</td>
                <td className="score-sheet-td tabular-nums text-right">{row.money_in_points || ""}</td>
              </tr>
            ))}

            {draftRows.map((row, rowIndex) => (
              <tr key={row.id} className="score-sheet-input-row">
                <td className="score-sheet-td p-0">
                  <input
                    type="text"
                    list="score-member-names"
                    value={row.nickname}
                    disabled={pending}
                    data-row={rowIndex}
                    data-col="nickname"
                    placeholder=""
                    className="score-sheet-input"
                    onChange={(e) => updateDraft(row.id, { nickname: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, "nickname")}
                  />
                </td>
                <td className="score-sheet-td p-0">
                  <input
                    type="number"
                    min={0}
                    value={row.buyIn}
                    disabled={pending}
                    data-row={rowIndex}
                    data-col="buyIn"
                    className="score-sheet-input text-right tabular-nums"
                    onChange={(e) => updateDraft(row.id, { buyIn: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, "buyIn")}
                  />
                </td>
                <td className="score-sheet-td p-0">
                  <input
                    type="number"
                    min={0}
                    value={row.rebuy}
                    disabled={pending}
                    data-row={rowIndex}
                    data-col="rebuy"
                    className="score-sheet-input text-right tabular-nums"
                    onChange={(e) => updateDraft(row.id, { rebuy: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, "rebuy")}
                  />
                </td>
                <td className="score-sheet-td p-0">
                  <input
                    type="number"
                    min={0}
                    value={row.moneyIn}
                    disabled={pending}
                    data-row={rowIndex}
                    data-col="moneyIn"
                    className="score-sheet-input text-right tabular-nums"
                    onChange={(e) => updateDraft(row.id, { moneyIn: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, "moneyIn")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="score-member-names">
          {memberNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div className="shrink-0 px-4 py-2 border-t border-white/10 flex justify-between items-center">
        <button
          type="button"
          onClick={addMoreRows}
          className="text-xs text-on-surface-variant hover:text-primary"
        >
          + 행 추가
        </button>
        <p className="text-[10px] text-on-surface-variant">Enter → 다음 칸 · 마지막 칸 Enter → 저장</p>
      </div>
    </section>
  );
}
