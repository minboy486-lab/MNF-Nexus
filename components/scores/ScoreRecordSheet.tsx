"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScoreSheetNicknameInput } from "@/components/scores/ScoreSheetNicknameInput";
import {
  setManualScoreRow,
  updateManualScoreRow,
  deleteManualScore,
} from "@/lib/actions/manual-scores";
import type { ManualScoreDaily, MemberSuggestion } from "@/lib/scores/types";

const LAST_DATE_KEY = "mnf-score-last-date";
const INITIAL_GAMES = 9;
const GAME_EXPAND_STEP = 3;
const INITIAL_DRAFT_ROWS = 20;
const ROW_EXPAND_STEP = 5;

type SheetCol = "nickname" | "buyIn" | "rebuy" | "moneyIn";
const SHEET_COLS: SheetCol[] = ["nickname", "buyIn", "rebuy", "moneyIn"];

type DraftRow = {
  id: string;
  recordId?: string;
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
  const [, m, d] = iso.split("-");
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

function savedToDraftRow(row: ManualScoreDaily): DraftRow {
  return {
    id: row.id,
    recordId: row.id,
    nickname: row.nickname,
    buyIn: row.buy_in_points ? String(row.buy_in_points) : "",
    rebuy: row.rebuy_points ? String(row.rebuy_points) : "",
    moneyIn: row.money_in_points ? String(row.money_in_points) : "",
  };
}

function rowsFromSavedAndPadding(saved: ManualScoreDaily[]): DraftRow[] {
  const filled = saved.map(savedToDraftRow);
  const pad = Math.max(INITIAL_DRAFT_ROWS - filled.length, 0);
  return [...filled, ...Array.from({ length: pad }, () => emptyRow())];
}

function buildDraftsFromSaved(
  savedRows: ManualScoreDaily[],
  gameCount: number,
): Record<number, DraftRow[]> {
  const byGame = new Map<number, ManualScoreDaily[]>();
  for (const row of savedRows) {
    const g = row.game_no ?? 1;
    const list = byGame.get(g) ?? [];
    list.push(row);
    byGame.set(g, list);
  }
  const result: Record<number, DraftRow[]> = {};
  for (let g = 1; g <= gameCount; g++) {
    result[g] = rowsFromSavedAndPadding(byGame.get(g) ?? []);
  }
  return result;
}

function expandDraftRowsIfFull(rows: DraftRow[]): DraftRow[] {
  if (rows.length === 0) return rows;
  const allFilled = rows.every((r) => r.nickname.trim());
  if (!allFilled) return rows;
  return [...rows, ...Array.from({ length: ROW_EXPAND_STEP }, () => emptyRow())];
}

function draftHasInput(rows: DraftRow[]): boolean {
  return rows.some(
    (r) =>
      r.nickname.trim() !== "" ||
      r.buyIn !== "" ||
      r.rebuy !== "" ||
      r.moneyIn !== "",
  );
}

function gameHasAnyInput(rows: DraftRow[] | undefined): boolean {
  return rows != null && draftHasInput(rows);
}

function visibleGamesForMax(maxGameNo: number): number {
  if (maxGameNo <= INITIAL_GAMES) return INITIAL_GAMES;
  return Math.ceil(maxGameNo / GAME_EXPAND_STEP) * GAME_EXPAND_STEP;
}

function resolveDefaultBuyIn(rows: DraftRow[]): string {
  for (const r of rows) {
    if (r.buyIn !== "") return r.buyIn;
  }
  return "";
}

function applyDefaultBuyIn(rows: DraftRow[], defaultBuyIn: string): DraftRow[] {
  if (!defaultBuyIn) return rows;
  return rows.map((r) =>
    r.nickname.trim() && r.buyIn === "" ? { ...r, buyIn: defaultBuyIn } : r,
  );
}

function isRowSaveable(row: DraftRow): boolean {
  if (!row.nickname.trim()) return false;
  const total =
    (Number(row.buyIn) || 0) + (Number(row.rebuy) || 0) + (Number(row.moneyIn) || 0);
  return total > 0;
}

type RowSavePatch = {
  recordId: string;
  nickname: string;
};

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
  const maxSavedGame = useMemo(
    () => savedRows.reduce((max, r) => Math.max(max, r.game_no ?? 1), 0),
    [savedRows],
  );

  const initialVisible = visibleGamesForMax(maxSavedGame);

  const [playDate, setPlayDate] = useState(initialDate);
  const [visibleGameCount, setVisibleGameCount] = useState(initialVisible);
  const [draftsByGame, setDraftsByGame] = useState<Record<number, DraftRow[]>>(() =>
    buildDraftsFromSaved(savedRows, initialVisible),
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openNicknameRowId, setOpenNicknameRowId] = useState<string | null>(null);

  const visibleGameCountRef = useRef(visibleGameCount);
  const draftsByGameRef = useRef(draftsByGame);
  const playDateRef = useRef(playDate);
  const lastFocusedGameRef = useRef<number | null>(null);
  const savingGameRef = useRef(false);
  const lastSyncedDateRef = useRef(initialDate);

  useEffect(() => {
    visibleGameCountRef.current = visibleGameCount;
  }, [visibleGameCount]);

  useEffect(() => {
    draftsByGameRef.current = draftsByGame;
  }, [draftsByGame]);

  useEffect(() => {
    playDateRef.current = playDate;
  }, [playDate]);

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

  useEffect(() => {
    if (initialDate === lastSyncedDateRef.current) return;
    lastSyncedDateRef.current = initialDate;
    const needed = visibleGamesForMax(maxSavedGame);
    setVisibleGameCount(needed);
    setDraftsByGame(buildDraftsFromSaved(savedRows, needed));
    setOpenNicknameRowId(null);
  }, [initialDate, maxSavedGame, savedRows]);

  useEffect(() => {
    const needed = visibleGamesForMax(maxSavedGame);
    setVisibleGameCount((prev) => Math.max(prev, needed));
    setDraftsByGame((prev) => {
      const next = { ...prev };
      for (let g = 1; g <= needed; g++) {
        if (!next[g]) next[g] = rowsFromSavedAndPadding([]);
      }
      return next;
    });
  }, [maxSavedGame]);

  async function saveOneRow(
    row: DraftRow,
    gameNo: number,
  ): Promise<{ ok: true; patch: RowSavePatch; memberCreated: boolean } | { ok: false; error: string }> {
    const input = {
      playDate: playDateRef.current,
      gameNo,
      nickname: row.nickname.trim(),
      buyInPoints: Number(row.buyIn) || 0,
      rebuyPoints: Number(row.rebuy) || 0,
      moneyInPoints: Number(row.moneyIn) || 0,
    };

    const result = row.recordId
      ? await updateManualScoreRow(row.recordId, input)
      : await setManualScoreRow(input);

    if ("error" in result && result.error) {
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      patch: {
        recordId: result.recordId!,
        nickname: result.nickname ?? row.nickname.trim(),
      },
      memberCreated: result.memberCreated ?? false,
    };
  }

  function applySavePatches(gameNo: number, patches: Map<string, RowSavePatch>) {
    setDraftsByGame((prev) => ({
      ...prev,
      [gameNo]: (prev[gameNo] ?? []).map((r) => {
        const patch = patches.get(r.id);
        if (!patch) return r;
        return { ...r, recordId: patch.recordId, nickname: patch.nickname };
      }),
    }));
  }

  async function saveGameDrafts(gameNo: number) {
    if (savingGameRef.current) return;

    const rows = draftsByGameRef.current[gameNo] ?? [];
    const saveable = rows.filter(isRowSaveable);
    if (saveable.length === 0) return;

    savingGameRef.current = true;
    setPending(true);
    setError(null);

    const patches = new Map<string, RowSavePatch>();
    let anyMemberCreated = false;

    for (const row of saveable) {
      const result = await saveOneRow(row, gameNo);
      if (!result.ok) {
        setError(result.error);
        break;
      }
      patches.set(row.id, result.patch);
      if (result.memberCreated) anyMemberCreated = true;
    }

    if (patches.size > 0) {
      localStorage.setItem(LAST_DATE_KEY, playDateRef.current);
      applySavePatches(gameNo, patches);
      setMessage(
        anyMemberCreated
          ? `${patches.size}명 저장 (신규 손님 포함)`
          : `${patches.size}명 저장`,
      );
      router.refresh();
    }

    savingGameRef.current = false;
    setPending(false);
  }

  function handleGameFocus(gameNo: number) {
    setOpenNicknameRowId(null);
    const prev = lastFocusedGameRef.current;
    lastFocusedGameRef.current = gameNo;
    if (prev == null || prev === gameNo) return;
    void saveGameDrafts(prev);
  }

  const navigateDate = useCallback(
    (date: string) => {
      localStorage.setItem(LAST_DATE_KEY, date);
      setPlayDate(date);
      router.push(`/admin/scores?date=${date}&from=${periodFrom}&to=${periodTo}`);
    },
    [periodFrom, periodTo, router],
  );

  function expandGamesIfNeeded(
    gameNo: number,
    drafts: Record<number, DraftRow[]>,
    visible: number,
  ): { drafts: Record<number, DraftRow[]>; visible: number } {
    const rows = drafts[gameNo];
    if (gameNo !== visible || !gameHasAnyInput(rows)) {
      return { drafts, visible };
    }
    const newVisible = visible + GAME_EXPAND_STEP;
    const next = { ...drafts };
    for (let g = visible + 1; g <= newVisible; g++) {
      if (!next[g]) next[g] = rowsFromSavedAndPadding([]);
    }
    return { drafts: next, visible: newVisible };
  }

  function updateDraft(gameNo: number, id: string, patch: Partial<DraftRow>) {
    setDraftsByGame((prev) => {
      let rows = (prev[gameNo] ?? rowsFromSavedAndPadding([])).map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      );

      const defaultBuyIn = resolveDefaultBuyIn(rows);
      if (defaultBuyIn && "nickname" in patch && patch.nickname?.trim()) {
        rows = rows.map((r) =>
          r.id === id && r.buyIn === "" ? { ...r, buyIn: defaultBuyIn } : r,
        );
      }
      if ("buyIn" in patch && patch.buyIn !== "") {
        rows = applyDefaultBuyIn(rows, resolveDefaultBuyIn(rows));
      }

      const updated = expandDraftRowsIfFull(rows);
      let next = { ...prev, [gameNo]: updated };
      const expanded = expandGamesIfNeeded(gameNo, next, visibleGameCountRef.current);
      if (expanded.visible !== visibleGameCountRef.current) {
        visibleGameCountRef.current = expanded.visible;
        setVisibleGameCount(expanded.visible);
        next = expanded.drafts;
      }
      return next;
    });
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    setMessage(null);
    setOpenNicknameRowId(null);

    let totalSaved = 0;
    let anyMemberCreated = false;

    for (let gameNo = 1; gameNo <= visibleGameCountRef.current; gameNo++) {
      const rows = draftsByGameRef.current[gameNo] ?? [];
      const saveable = rows.filter(isRowSaveable);
      const patches = new Map<string, RowSavePatch>();

      for (const row of saveable) {
        const result = await saveOneRow(row, gameNo);
        if (!result.ok) {
          setError(result.error);
          setPending(false);
          if (totalSaved > 0) router.refresh();
          return;
        }
        patches.set(row.id, result.patch);
        if (result.memberCreated) anyMemberCreated = true;
      }

      if (patches.size > 0) {
        totalSaved += patches.size;
        applySavePatches(gameNo, patches);
      }
    }

    setPending(false);

    if (totalSaved === 0) {
      setError("저장할 행이 없습니다. 닉네임과 점수를 입력하세요.");
      return;
    }

    localStorage.setItem(LAST_DATE_KEY, playDateRef.current);
    setMessage(
      anyMemberCreated
        ? `${totalSaved}명 기록 저장 (신규 손님 포함)`
        : `${totalSaved}명 기록 저장`,
    );
    router.refresh();
  }

  async function handleDelete(recordId: string, gameNo: number, rowId: string) {
    if (!confirm("이 행을 삭제할까요?")) return;
    setPending(true);
    const result = await deleteManualScore(recordId);
    setPending(false);
    if ("error" in result && result.error) {
      alert(result.error);
      return;
    }
    setDraftsByGame((prev) => ({
      ...prev,
      [gameNo]: (prev[gameNo] ?? []).map((r) => (r.id === rowId ? emptyRow() : r)),
    }));
    router.refresh();
  }

  const enterNavLockRef = useRef(false);

  function navigateCell(
    gameNo: number,
    rowIndex: number,
    col: SheetCol,
    direction: "up" | "down" | "left" | "right",
  ) {
    const rows = draftsByGame[gameNo] ?? [];
    const colIdx = SHEET_COLS.indexOf(col);

    if (direction === "right" && colIdx < SHEET_COLS.length - 1) {
      focusCell(gameNo, rowIndex, SHEET_COLS[colIdx + 1]);
    } else if (direction === "left" && colIdx > 0) {
      focusCell(gameNo, rowIndex, SHEET_COLS[colIdx - 1]);
    } else if (direction === "down" && rowIndex < rows.length - 1) {
      focusCell(gameNo, rowIndex + 1, col);
    } else if (direction === "up" && rowIndex > 0) {
      focusCell(gameNo, rowIndex - 1, col);
    }
  }

  function handleCellKeyDown(
    e: React.KeyboardEvent,
    gameNo: number,
    rowIndex: number,
    col: SheetCol,
  ) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      navigateCell(gameNo, rowIndex, col, "right");
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      navigateCell(gameNo, rowIndex, col, "left");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateCell(gameNo, rowIndex, col, "down");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateCell(gameNo, rowIndex, col, "up");
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (enterNavLockRef.current) return;
    enterNavLockRef.current = true;

    const colIdx = SHEET_COLS.indexOf(col);
    const nextCol = SHEET_COLS[colIdx + 1];
    const rows = draftsByGame[gameNo] ?? [];

    if (nextCol) {
      focusCell(gameNo, rowIndex, nextCol);
    } else if (rowIndex < rows.length - 1) {
      focusCell(gameNo, rowIndex + 1, "nickname");
    } else if (gameNo < visibleGameCountRef.current) {
      focusCell(gameNo + 1, 0, "nickname");
    } else {
      void handleSave();
    }

    window.setTimeout(() => {
      enterNavLockRef.current = false;
    }, 50);
  }

  function focusCell(gameNo: number, rowIndex: number, col: SheetCol) {
    window.setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(
        `[data-game="${gameNo}"][data-row="${rowIndex}"][data-col="${col}"]`,
      );
      el?.focus();
      if (col !== "nickname") el?.select();
    }, 0);
  }

  function focusCellFromNickname(gameNo: number, rowIndex: number) {
    focusCell(gameNo, rowIndex, "buyIn");
  }

  const dayTotal = savedRows.reduce(
    (sum, r) => sum + r.buy_in_points + r.rebuy_points + r.money_in_points,
    0,
  );

  return (
    <section className="score-record-panel glass-panel rounded-xl flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="score-record-toolbar shrink-0 px-3 py-1.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="score-record-date group inline-flex items-center gap-1.5"
          >
            <span className="text-sm font-bold text-primary group-hover:underline">
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
          <span className="text-[10px] text-on-surface-variant hidden sm:inline">
            · 다른 게임 클릭 시 해당 게임 저장
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-on-surface-variant">
            {savedRows.length}명 · <span className="text-primary font-semibold">{dayTotal}</span>점
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleSave()}
            className="btn-primary px-3 py-1 rounded-md text-xs font-semibold disabled:opacity-50"
          >
            {pending ? "저장 중…" : "입력 저장"}
          </button>
        </div>
      </div>

      {(error || message) && (
        <div
          className={`shrink-0 px-3 py-1.5 text-[11px] border-b ${
            error
              ? "text-error bg-error/10 border-error/20"
              : "text-primary bg-primary/10 border-primary/20"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-1.5">
        <div className="score-games-grid">
          {Array.from({ length: visibleGameCount }, (_, i) => i + 1).map((gameNo) => (
            <GameBlock
              key={gameNo}
              gameNo={gameNo}
              rows={draftsByGame[gameNo] ?? rowsFromSavedAndPadding([])}
              pending={pending}
              openNicknameRowId={openNicknameRowId}
              onOpenNicknameRowId={setOpenNicknameRowId}
              onUpdate={(id, patch) => updateDraft(gameNo, id, patch)}
              onDelete={(recordId, rowId) => void handleDelete(recordId, gameNo, rowId)}
              onCellKeyDown={(e, rowIndex, col) => handleCellKeyDown(e, gameNo, rowIndex, col)}
              onArrowNav={(rowIndex, col, dir) => navigateCell(gameNo, rowIndex, col, dir)}
              onEnterFromNickname={(rowIndex) => focusCellFromNickname(gameNo, rowIndex)}
              onGameFocus={() => handleGameFocus(gameNo)}
              members={members}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 px-3 py-1 border-t border-white/10 text-[10px] text-on-surface-variant text-right">
        Enter → 다음 칸 · ↑↓←→ 이동 · 다른 게임 클릭 시 저장
      </div>
    </section>
  );
}

function GameBlock({
  gameNo,
  rows,
  pending,
  members,
  openNicknameRowId,
  onOpenNicknameRowId,
  onUpdate,
  onDelete,
  onCellKeyDown,
  onArrowNav,
  onEnterFromNickname,
  onGameFocus,
}: {
  gameNo: number;
  rows: DraftRow[];
  pending: boolean;
  members: MemberSuggestion[];
  openNicknameRowId: string | null;
  onOpenNicknameRowId: (rowId: string | null) => void;
  onUpdate: (id: string, patch: Partial<DraftRow>) => void;
  onDelete: (recordId: string, rowId: string) => void;
  onCellKeyDown: (
    e: React.KeyboardEvent,
    rowIndex: number,
    col: SheetCol,
  ) => void;
  onArrowNav: (
    rowIndex: number,
    col: SheetCol,
    direction: "up" | "down" | "left" | "right",
  ) => void;
  onEnterFromNickname: (rowIndex: number) => void;
  onGameFocus: () => void;
}) {
  const focusProps = { onFocus: onGameFocus };
  const savedCount = rows.filter((r) => r.recordId).length;

  return (
    <div className="score-game-block">
      <div className="score-game-label flex items-center justify-between gap-1">
        <span>{gameNo}게임</span>
        {savedCount > 0 && (
          <span className="text-[9px] font-normal text-on-surface-variant">{savedCount}명 저장</span>
        )}
      </div>
      <table className="score-record-sheet w-full border-collapse">
        <colgroup>
          <col className="score-sheet-col-num" />
          <col className="score-sheet-col-nick" />
          <col className="score-sheet-col-score" />
          <col className="score-sheet-col-score" />
          <col className="score-sheet-col-score" />
        </colgroup>
        <thead>
          <tr>
            <th className="score-sheet-th score-sheet-th-num" aria-label="번호" />
            <th className="score-sheet-th">닉네임</th>
            <th className="score-sheet-th">바이인</th>
            <th className="score-sheet-th">리바인</th>
            <th className="score-sheet-th">머니인</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.id}
              className={row.recordId ? "score-sheet-saved-row" : "score-sheet-input-row"}
            >
              <td className="score-sheet-td score-sheet-td-num tabular-nums">
                {rowIndex + 1}
              </td>
              <td className="score-sheet-td p-0">
                <div className="score-sheet-nick-cell">
                  <ScoreSheetNicknameInput
                    members={members}
                    value={row.nickname}
                    disabled={pending}
                    gameNo={gameNo}
                    rowIndex={rowIndex}
                    rowId={row.id}
                    openRowId={openNicknameRowId}
                    onOpenChange={onOpenNicknameRowId}
                    onChange={(nickname) => onUpdate(row.id, { nickname })}
                    onEnterNext={() => onEnterFromNickname(rowIndex)}
                    onArrowNav={(dir) => onArrowNav(rowIndex, "nickname", dir)}
                    onFocus={onGameFocus}
                  />
                  {row.recordId && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onDelete(row.recordId!, row.id)}
                      className="score-sheet-row-delete"
                      aria-label="삭제"
                      tabIndex={-1}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </td>
              <td className="score-sheet-td p-0">
                <input
                  type="number"
                  min={0}
                  value={row.buyIn}
                  disabled={pending}
                  data-game={gameNo}
                  data-row={rowIndex}
                  data-col="buyIn"
                  className="score-sheet-input text-right tabular-nums"
                  onChange={(e) => onUpdate(row.id, { buyIn: e.target.value })}
                  onKeyDown={(e) => onCellKeyDown(e, rowIndex, "buyIn")}
                  {...focusProps}
                />
              </td>
              <td className="score-sheet-td p-0">
                <input
                  type="number"
                  min={0}
                  value={row.rebuy}
                  disabled={pending}
                  data-game={gameNo}
                  data-row={rowIndex}
                  data-col="rebuy"
                  className="score-sheet-input text-right tabular-nums"
                  onChange={(e) => onUpdate(row.id, { rebuy: e.target.value })}
                  onKeyDown={(e) => onCellKeyDown(e, rowIndex, "rebuy")}
                  {...focusProps}
                />
              </td>
              <td className="score-sheet-td p-0">
                <input
                  type="number"
                  min={0}
                  value={row.moneyIn}
                  disabled={pending}
                  data-game={gameNo}
                  data-row={rowIndex}
                  data-col="moneyIn"
                  className="score-sheet-input text-right tabular-nums"
                  onChange={(e) => onUpdate(row.id, { moneyIn: e.target.value })}
                  onKeyDown={(e) => onCellKeyDown(e, rowIndex, "moneyIn")}
                  {...focusProps}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
