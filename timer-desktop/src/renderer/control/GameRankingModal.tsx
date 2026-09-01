import { useMemo, useState } from "react";
import type { GameSession } from "../../shared/types";
import { tableLetter } from "../../shared/types";
import {
  PARTICIPATION_BUY_IN_POINTS,
  RANK_MONEY_IN_POINTS,
  type RankingEntry,
} from "../../shared/participants";

type RankRow = {
  memberId: string;
  nickname: string;
  tableSlot: number | null;
  rank: string;
  buyIn: string;
  moneyIn: string;
};

type Props = {
  session: GameSession;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (rankings: RankingEntry[]) => void;
};

function initRows(session: GameSession): RankRow[] {
  return (session.participants ?? []).map((p) => ({
    memberId: p.memberId,
    nickname: p.nickname,
    tableSlot: p.tableSlot,
    rank: "",
    buyIn: String(PARTICIPATION_BUY_IN_POINTS),
    moneyIn: "",
  }));
}

function parsePoints(value: string, fallback = 0): number {
  const n = Number(value.trim());
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function suggestMoneyIn(rank: number): string {
  if (rank >= 1 && rank <= 3) return String(RANK_MONEY_IN_POINTS[rank] ?? "");
  return "";
}

export function GameRankingModal({ session, pending, onCancel, onConfirm }: Props) {
  const [rows, setRows] = useState<RankRow[]>(() => initRows(session));

  function patchRow(memberId: string, patch: Partial<RankRow>) {
    setRows((prev) => prev.map((r) => (r.memberId === memberId ? { ...r, ...patch } : r)));
  }

  function setRank(memberId: string, value: string) {
    const digits = value.replace(/\D/g, "");
    setRows((prev) =>
      prev.map((r) => {
        if (r.memberId !== memberId) return r;
        const next: RankRow = { ...r, rank: digits };
        if (digits && !r.moneyIn) {
          const suggested = suggestMoneyIn(Number(digits));
          if (suggested) next.moneyIn = suggested;
        }
        return next;
      }),
    );
  }

  function setBuyIn(memberId: string, value: string) {
    patchRow(memberId, { buyIn: value.replace(/\D/g, "") });
  }

  function setMoneyIn(memberId: string, value: string) {
    patchRow(memberId, { moneyIn: value.replace(/\D/g, "") });
  }

  function handleSubmit() {
    const rankings: RankingEntry[] = rows.map((r) => ({
      memberId: r.memberId,
      nickname: r.nickname,
      rank: r.rank ? Number(r.rank) : null,
      buyInPoints: parsePoints(r.buyIn, PARTICIPATION_BUY_IN_POINTS),
      moneyInPoints: parsePoints(r.moneyIn, 0),
    }));
    onConfirm(rankings);
  }

  const preview = useMemo(
    () =>
      rows.map((r) => {
        const buyIn = parsePoints(r.buyIn, PARTICIPATION_BUY_IN_POINTS);
        const moneyIn = parsePoints(r.moneyIn, 0);
        return { ...r, buyIn, moneyIn, total: buyIn + moneyIn };
      }),
    [rows],
  );

  return (
    <div className="ranking-modal-overlay" onClick={onCancel}>
      <div className="ranking-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ranking-modal__title">게임 종료 · 순위 · 승점</h3>
        <p className="ranking-modal__hint">
          {session.dailyGameNo}게임 · 바인·순위점수를 직접 입력하세요. (바인 기본 {PARTICIPATION_BUY_IN_POINTS}점)
        </p>

        {rows.length === 0 ? (
          <p className="muted">등록된 참가 손님이 없습니다. 승점 없이 종료됩니다.</p>
        ) : (
          <table className="ranking-table">
            <thead>
              <tr>
                <th>닉네임</th>
                <th>테이블</th>
                <th>순위</th>
                <th>바인</th>
                <th>순위점수</th>
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.memberId}>
                  <td className="ranking-table__name">{r.nickname}</td>
                  <td className="ranking-table__table">{r.tableSlot ? tableLetter(r.tableSlot) : "—"}</td>
                  <td>
                    <input
                      className="ranking-table__input ranking-table__input--rank"
                      inputMode="numeric"
                      placeholder="—"
                      value={r.rank}
                      onChange={(e) => setRank(r.memberId, e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="ranking-table__input ranking-table__input--points"
                      inputMode="numeric"
                      placeholder={String(PARTICIPATION_BUY_IN_POINTS)}
                      value={r.buyIn}
                      onChange={(e) => setBuyIn(r.memberId, e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="ranking-table__input ranking-table__input--points"
                      inputMode="numeric"
                      placeholder="0"
                      value={r.moneyIn}
                      onChange={(e) => setMoneyIn(r.memberId, e.target.value)}
                    />
                  </td>
                  <td className="ranking-table__total">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="ranking-modal__actions">
          <button type="button" className="settings-popup__btn settings-popup__btn--cancel" disabled={pending} onClick={onCancel}>
            취소
          </button>
          <button type="button" className="settings-popup__btn settings-popup__btn--active" disabled={pending} onClick={handleSubmit}>
            {pending ? "저장 중…" : "승점 저장 · 게임 종료"}
          </button>
        </div>
      </div>
    </div>
  );
}
