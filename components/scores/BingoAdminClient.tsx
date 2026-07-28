"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  addBingoMark,
  removeBingoMark,
  saveBingoCellLabels,
} from "@/lib/actions/bingo";
import { formatMonthKeyLabel, type BingoMonthSheet } from "@/lib/events/types";
import type { MemberSuggestion } from "@/lib/scores/types";
import { NicknameAutocomplete } from "@/components/scores/NicknameAutocomplete";

type Props = {
  sheet: BingoMonthSheet;
  members: MemberSuggestion[];
};

function BingoAdminCellModal({
  cellNo,
  label,
  marks,
  members,
  missionDraft,
  nickname,
  pending,
  onClose,
  onMissionDraftChange,
  onSaveMission,
  onNicknameChange,
  onAddMark,
  onRemoveMark,
}: {
  cellNo: number;
  label: string;
  marks: BingoMonthSheet["marks"];
  members: MemberSuggestion[];
  missionDraft: string;
  nickname: string;
  pending: boolean;
  onClose: () => void;
  onMissionDraftChange: (value: string) => void;
  onSaveMission: () => void;
  onNicknameChange: (value: string) => void;
  onAddMark: () => void;
  onRemoveMark: (markId: string) => void;
}) {
  return (
    <div
      className="public-ranking-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bingo-admin-cell-modal-title"
      onClick={onClose}
    >
      <div
        className="public-ranking-modal bingo-admin-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <span className="bingo-admin-cell-no shrink-0">{cellNo}</span>
          <div className="min-w-0 flex-1">
            <h2 id="bingo-admin-cell-modal-title" className="text-base font-bold leading-snug">
              {label}
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">완료 {marks.length}명</p>
          </div>
        </div>

        <div className="bingo-admin-mission-edit mt-4">
          <label className="text-[11px] font-semibold text-on-surface-variant mb-1 block">
            미션 문구
          </label>
          <input
            type="text"
            value={missionDraft}
            onChange={(e) => onMissionDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSaveMission();
              }
            }}
            className="admin-toolbar-input w-full"
            placeholder="미션 문구"
            autoFocus
          />
          <div className="bingo-admin-mission-actions mt-2">
            <button
              type="button"
              disabled={pending}
              onClick={onSaveMission}
              className="btn-primary px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>

        <ul className="bingo-admin-marks bingo-admin-marks-modal">
          {marks.length === 0 ? (
            <li className="bingo-admin-marks-empty">등록된 닉네임 없음</li>
          ) : (
            marks.map((mark) => (
              <li key={mark.id} className="bingo-admin-mark">
                <span>{mark.nickname}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRemoveMark(mark.id)}
                  className="bingo-admin-mark-remove"
                  aria-label={`${mark.nickname} 삭제`}
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="bingo-admin-add mt-4">
          <NicknameAutocomplete
            members={members}
            value={nickname}
            onChange={onNicknameChange}
            disabled={pending}
            id={`bingo-nick-modal-${cellNo}`}
            enterSubmits
            onEnter={onAddMark}
          />
          <button
            type="button"
            disabled={pending || !nickname.trim()}
            onClick={onAddMark}
            className="btn-primary px-3 py-2 rounded-md text-xs font-semibold disabled:opacity-50 shrink-0"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}

export function BingoAdminClient({ sheet, members }: Props) {
  const router = useRouter();
  const [labels, setLabels] = useState(sheet.cell_labels);
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [missionDraft, setMissionDraft] = useState("");
  const [cellNicknames, setCellNicknames] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLabels(sheet.cell_labels);
    setActiveCell(null);
    setCellNicknames({});
    setError(null);
    setMessage(null);
  }, [sheet.month_key, sheet.cell_labels]);

  useEffect(() => {
    if (activeCell === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveCell(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeCell]);

  const marksByCell = useMemo(() => {
    const map = new Map<number, typeof sheet.marks>();
    for (let i = 1; i <= 16; i++) map.set(i, []);
    for (const mark of sheet.marks) {
      map.get(mark.cell_no)?.push(mark);
    }
    return map;
  }, [sheet.marks]);

  function navigateMonth(monthKey: string) {
    router.push(`/admin/scores/bingo?month=${monthKey}`);
  }

  function openCell(cellNo: number) {
    setActiveCell(cellNo);
    setMissionDraft(labels[cellNo - 1] ?? "");
    setError(null);
    setMessage(null);
  }

  function closeCell() {
    setActiveCell(null);
  }

  function setCellNickname(cellNo: number, value: string) {
    setCellNicknames((prev) => ({ ...prev, [cellNo]: value }));
  }

  async function handleSaveMission(cellNo: number) {
    const next = labels.map((v, i) => (i === cellNo - 1 ? missionDraft.trim() || v : v));
    setPending(true);
    setError(null);
    const res = await saveBingoCellLabels(sheet.month_key, next);
    setPending(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setLabels(next);
    setMessage("미션을 저장했습니다.");
    router.refresh();
  }

  async function handleAddMark(cellNo: number) {
    const nick = (cellNicknames[cellNo] ?? "").trim();
    if (!nick) return;

    setPending(true);
    setError(null);
    const res = await addBingoMark(sheet.month_key, cellNo, nick);
    setPending(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setCellNicknames((prev) => ({ ...prev, [cellNo]: "" }));
    setMessage("닉네임을 등록했습니다.");
    router.refresh();
  }

  async function handleRemoveMark(markId: string) {
    setPending(true);
    setError(null);
    const res = await removeBingoMark(markId);
    setPending(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const activeIndex = activeCell !== null ? activeCell - 1 : -1;
  const modalNick = activeCell !== null ? (cellNicknames[activeCell] ?? "") : "";

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <section className="score-record-panel glass-panel rounded-xl flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="score-list-toolbar shrink-0">
          <div className="score-list-toolbar-field">
            <span className="score-list-toolbar-label">월</span>
            <input
              type="month"
              value={sheet.month_key}
              onChange={(e) => navigateMonth(e.target.value)}
              className="admin-toolbar-input"
              aria-label="빙고 월 선택"
            />
          </div>
          <span className="score-list-toolbar-meta ml-auto hidden sm:inline">
            칸 클릭 · 미션 편집 · Enter 등록
          </span>
          <span className="score-list-toolbar-meta ml-auto sm:ml-2">
            {formatMonthKeyLabel(sheet.month_key)} · {sheet.marks.length}건
          </span>
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

        <div className="bingo-admin-grid-wrap">
          <div className="bingo-admin-grid">
            {Array.from({ length: 16 }, (_, i) => {
              const cellNo = i + 1;
              const marks = marksByCell.get(cellNo) ?? [];
              const active = activeCell === cellNo;
              const inlineNick = cellNicknames[cellNo] ?? "";

              return (
                <div
                  key={cellNo}
                  className={`bingo-admin-cell ${
                    marks.length > 0 ? "bingo-admin-cell-done" : ""
                  } ${active ? "bingo-admin-cell-active" : ""}`}
                >
                  <button
                    type="button"
                    className="bingo-admin-cell-overlay"
                    onClick={() => openCell(cellNo)}
                    aria-label={`${labels[i]} · 칸 열기`}
                    aria-expanded={active}
                  />

                  <div className="bingo-admin-cell-body">
                    <div className="bingo-admin-cell-head">
                      <span className="bingo-admin-cell-no">{cellNo}</span>
                      <span className="bingo-admin-cell-label">{labels[i]}</span>
                      {marks.length > 0 && (
                        <span className="bingo-admin-cell-count">{marks.length}</span>
                      )}
                    </div>

                    {marks.length > 0 && (
                      <ul className="bingo-admin-marks-preview">
                        {marks.map((mark) => (
                          <li key={mark.id}>{mark.nickname}</li>
                        ))}
                      </ul>
                    )}

                    <div className="bingo-admin-cell-foot">
                      <div className="bingo-admin-add bingo-admin-add-inline">
                        <NicknameAutocomplete
                          members={members}
                          value={inlineNick}
                          onChange={(value) => setCellNickname(cellNo, value)}
                          disabled={pending}
                          id={`bingo-nick-inline-${cellNo}`}
                          enterSubmits
                          onEnter={() => void handleAddMark(cellNo)}
                        />
                        <button
                          type="button"
                          disabled={pending || !inlineNick.trim()}
                          onClick={() => void handleAddMark(cellNo)}
                          className="btn-primary px-2 py-1 rounded-md text-[10px] font-semibold disabled:opacity-50 shrink-0"
                        >
                          등록
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {activeCell !== null && activeIndex >= 0 && (
        <BingoAdminCellModal
          cellNo={activeCell}
          label={labels[activeIndex] ?? ""}
          marks={marksByCell.get(activeCell) ?? []}
          members={members}
          missionDraft={missionDraft}
          nickname={modalNick}
          pending={pending}
          onClose={closeCell}
          onMissionDraftChange={setMissionDraft}
          onSaveMission={() => void handleSaveMission(activeCell)}
          onNicknameChange={(value) => setCellNickname(activeCell, value)}
          onAddMark={() => void handleAddMark(activeCell)}
          onRemoveMark={(id) => void handleRemoveMark(id)}
        />
      )}
    </div>
  );
}
