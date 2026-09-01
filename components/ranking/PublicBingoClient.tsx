"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicGuestHeader } from "@/components/ranking/PublicGuestHeader";
import { formatMonthKeyLabel, type BingoMark, type BingoMonthSheet } from "@/lib/events/types";
import { useGuestNickname } from "@/lib/ranking/use-guest-nickname";
import { usePublicScoresSync } from "@/lib/ranking/use-public-scores-sync";

type Props = {
  sheet: BingoMonthSheet;
  memberNickname?: string;
  embedded?: boolean;
};

function BingoCellModal({
  label,
  marks,
  myNickname,
  onClose,
}: {
  label: string;
  marks: BingoMark[];
  myNickname: string | null;
  onClose: () => void;
}) {
  const myQuery = myNickname?.trim().toLowerCase() ?? "";

  return (
    <div
      className="public-ranking-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bingo-cell-modal-title"
      onClick={onClose}
    >
      <div
        className="public-ranking-modal public-bingo-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="bingo-cell-modal-title" className="text-base font-bold leading-snug pr-6">
          {label}
        </h2>
        <p className="text-xs text-on-surface-variant mt-1 mb-4">
          완료 {marks.length}명
        </p>
        {marks.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">아직 완료 기록이 없습니다.</p>
        ) : (
          <ul className="public-bingo-detail-list">
            {marks.map((m) => {
              const isMine = myQuery && m.nickname.toLowerCase() === myQuery;
              return (
                <li
                  key={m.id}
                  className={isMine ? "public-bingo-detail-item-mine" : undefined}
                >
                  {m.nickname}
                  {isMine && <span className="public-rank-badge-me text-[9px] ml-1.5">ME</span>}
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={onClose}
          className="btn-primary w-full mt-5 py-2.5 rounded-xl text-sm font-bold"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export function PublicBingoClient({ sheet, memberNickname, embedded = false }: Props) {
  const guestNick = useGuestNickname();
  const nickname = memberNickname ?? guestNick.nickname;
  const showNicknameModal = memberNickname ? false : guestNick.showNicknameModal;
  const saveNickname = guestNick.saveNickname;
  const openEdit = guestNick.openEdit;
  const closeEdit = guestNick.closeEdit;
  const [expandedCell, setExpandedCell] = useState<number | null>(null);

  usePublicScoresSync("bingo");

  useEffect(() => {
    if (expandedCell === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpandedCell(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedCell]);

  const marksByCell = useMemo(() => {
    const map = new Map<number, BingoMark[]>();
    for (let i = 1; i <= 16; i++) map.set(i, []);
    for (const mark of sheet.marks) {
      map.get(mark.cell_no)?.push(mark);
    }
    return map;
  }, [sheet.marks]);

  const myCompleted = useMemo(() => {
    if (!nickname) return 0;
    const q = nickname.trim().toLowerCase();
    return sheet.marks.filter((m) => m.nickname.toLowerCase() === q).length;
  }, [sheet.marks, nickname]);

  const expandedIndex = expandedCell !== null ? expandedCell - 1 : -1;

  return (
    <div className={embedded ? "" : "public-ranking-page"}>
      {!embedded && (
        <PublicGuestHeader
          nickname={nickname}
          showNicknameModal={showNicknameModal}
          onSaveNickname={saveNickname}
          onOpenEdit={openEdit}
          onCloseEdit={closeEdit}
        />
      )}

      {!embedded ? (
        <div className="public-ranking-hero">
          <h1 className="text-[1.75rem] font-black tracking-tight">EVENT BINGO</h1>
          <p className="text-sm text-on-surface-variant mt-1">{formatMonthKeyLabel(sheet.month_key)}</p>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant mb-3">{formatMonthKeyLabel(sheet.month_key)}</p>
      )}

      {nickname && (
        <section className="public-ranking-my-card public-ranking-my-card-found mb-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-primary">내 빙고</span>
            <span className="public-rank-badge-me">ME</span>
          </div>
          <p className="text-sm text-on-surface-variant">
            <span className="font-bold text-on-surface">{nickname}</span> ·{" "}
            <span className="text-primary font-bold tabular-nums">{myCompleted}</span>
            /16 칸 완료
          </p>
        </section>
      )}

      <div className="public-bingo-grid">
        {Array.from({ length: 16 }, (_, i) => {
          const cellNo = i + 1;
          const marks = marksByCell.get(cellNo) ?? [];
          const hasMine =
            nickname &&
            marks.some((m) => m.nickname.toLowerCase() === nickname.trim().toLowerCase());

          return (
            <button
              key={cellNo}
              type="button"
              className={`public-bingo-cell ${hasMine ? "public-bingo-cell-mine" : ""}`}
              onClick={() => setExpandedCell(cellNo)}
            >
              <span className="public-bingo-cell-label">{sheet.cell_labels[i]}</span>
              {marks.length > 0 && (
                <ul className="public-bingo-nicks" aria-label="완료 닉네임">
                  {marks.map((m) => (
                    <li key={m.id}>{m.nickname}</li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      {expandedCell !== null && expandedIndex >= 0 && (
        <BingoCellModal
          label={sheet.cell_labels[expandedIndex] ?? ""}
          marks={marksByCell.get(expandedCell) ?? []}
          myNickname={nickname}
          onClose={() => setExpandedCell(null)}
        />
      )}
    </div>
  );
}
