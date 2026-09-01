import { useCallback, useEffect, useMemo, useState } from "react";
import type { TableTimerState } from "@mnf/timer/types";
import { formatRemainingMs, getDisplayRemainingMs } from "@mnf/timer/engine";
import { formatTimerLevelShort } from "@mnf/timer/levels";
import type { AppSnapshot, GameSession, TableSlot } from "../../shared/types";
import { tableName } from "../../shared/types";
import type { OnFloorGuest } from "../../preload/control";
import type { GameParticipant } from "../../shared/participants";
import { sortParticipants } from "../../shared/participants";

type AssignedTable = {
  slot: TableSlot;
  gameId: number;
  session: GameSession;
};

type DragState = {
  memberId: string;
  fromTableSlot: TableSlot;
  gameId: number;
};

type Props = {
  snapshot: AppSnapshot;
  timers: TableTimerState[];
  openedFromSlot?: number | null;
  onError?: (msg: string) => void;
  onBack: () => void;
  onRequestEndGame?: (gameId: number) => void;
};

function collectAssignedTables(snapshot: AppSnapshot): AssignedTable[] {
  const rows: AssignedTable[] = [];
  for (const [slotKey, gameId] of Object.entries(snapshot.tableAssignments)) {
    if (gameId == null) continue;
    const session = snapshot.sessions.find((s) => s.gameId === gameId);
    if (!session) continue;
    rows.push({ slot: Number(slotKey) as TableSlot, gameId, session });
  }
  rows.sort((a, b) => a.slot - b.slot);
  return rows;
}

function participantsAtTable(session: GameSession, tableSlot: TableSlot): GameParticipant[] {
  return sortParticipants((session.participants ?? []).filter((p) => p.tableSlot === tableSlot));
}

export function TableGuestsView({ snapshot, timers, openedFromSlot, onError, onBack, onRequestEndGame }: Props) {
  const tables = useMemo(() => collectAssignedTables(snapshot), [snapshot]);
  const uniqueSessions = useMemo(() => {
    const seen = new Map<number, GameSession>();
    for (const t of tables) {
      if (!seen.has(t.gameId)) seen.set(t.gameId, t.session);
    }
    return [...seen.values()];
  }, [tables]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [listDragOverSlot, setListDragOverSlot] = useState<TableSlot | null>(null);
  const [cardDragOverId, setCardDragOverId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const sessionByGameId = useMemo(() => {
    const map = new Map<number, GameSession>();
    for (const s of snapshot.sessions) map.set(s.gameId, s);
    return map;
  }, [snapshot.sessions]);

  const clearDrag = useCallback(() => {
    setDrag(null);
    setListDragOverSlot(null);
    setCardDragOverId(null);
  }, []);

  const persistOrder = useCallback(
    async (gameId: number, memberIds: string[]) => {
      const res = await window.controlApi.reorderParticipants(gameId, memberIds);
      if (!res.ok) onError?.(res.error);
    },
    [onError],
  );

  const handleDrop = useCallback(
    async (target: { tableSlot: TableSlot; gameId: number; beforeMemberId?: string }) => {
      if (!drag) return;

      if (drag.gameId !== target.gameId) {
        onError?.("다른 게임 손님은 테이블 간 이동할 수 없습니다.");
        clearDrag();
        return;
      }

      const session = sessionByGameId.get(target.gameId);
      if (!session) {
        clearDrag();
        return;
      }

      setPending(true);

      if (drag.fromTableSlot !== target.tableSlot) {
        const moveRes = await window.controlApi.moveParticipantTable(
          drag.gameId,
          drag.memberId,
          target.tableSlot,
        );
        if (!moveRes.ok) {
          setPending(false);
          onError?.(moveRes.error);
          clearDrag();
          return;
        }
      }

      const afterMove = (session.participants ?? []).map((p) =>
        p.memberId === drag.memberId ? { ...p, tableSlot: target.tableSlot } : p,
      );

      const targetOthers = sortParticipants(
        afterMove.filter((p) => p.tableSlot === target.tableSlot && p.memberId !== drag.memberId),
      ).map((p) => p.memberId);

      let targetIds: string[];
      if (target.beforeMemberId && target.beforeMemberId !== drag.memberId) {
        const insertAt = targetOthers.indexOf(target.beforeMemberId);
        targetIds =
          insertAt >= 0
            ? [...targetOthers.slice(0, insertAt), drag.memberId, ...targetOthers.slice(insertAt)]
            : [...targetOthers, drag.memberId];
      } else {
        targetIds = [...targetOthers, drag.memberId];
      }

      await persistOrder(target.gameId, targetIds);

      if (drag.fromTableSlot !== target.tableSlot) {
        const sourceIds = sortParticipants(
          afterMove.filter((p) => p.tableSlot === drag.fromTableSlot && p.memberId !== drag.memberId),
        ).map((p) => p.memberId);
        if (sourceIds.length > 0) {
          await persistOrder(drag.gameId, sourceIds);
        }
      }

      setPending(false);
      clearDrag();
    },
    [drag, sessionByGameId, onError, clearDrag, persistOrder],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

  if (tables.length === 0) {
    return (
      <div className="table-guests table-guests--empty">
        <p className="muted">게임이 연결된 테이블이 없습니다.</p>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          플로어로 돌아가기
        </button>
      </div>
    );
  }

  const colClass =
    tables.length >= 3 ? "table-guests--cols-3" : tables.length === 2 ? "table-guests--cols-2" : "table-guests--cols-1";

  return (
    <div className={`table-guests ${colClass}`}>
      <header className="table-guests__toolbar">
        <div className="table-guests__toolbar-left">
          <button type="button" className="page-back-btn" onClick={onBack}>
            ← 플로어
          </button>
          <h1 className="table-guests__page-title">테이블 손님</h1>
        </div>
        <span className="table-guests__esc-hint">Esc — 닫기</span>
      </header>
      {uniqueSessions.map((session) => (
        <GameStatsBar
          key={session.gameId}
          session={session}
          timer={timers.find((t) => t.tableId === session.gameId)}
          onRequestEndGame={onRequestEndGame}
        />
      ))}
      <div className={`table-guests__grid ${colClass}`}>
        {tables.map((t) => (
          <TableGuestPanel
            key={t.slot}
            tableSlot={t.slot}
            session={t.session}
            highlighted={openedFromSlot === t.slot}
            pending={pending}
            drag={drag}
            listDragOver={listDragOverSlot === t.slot}
            cardDragOverId={cardDragOverId}
            onError={onError}
            onDragStart={(memberId) =>
              setDrag({ memberId, fromTableSlot: t.slot, gameId: t.gameId })
            }
            onDragEnd={clearDrag}
            onListDragEnter={() => setListDragOverSlot(t.slot)}
            onListDragLeave={() => setListDragOverSlot((prev) => (prev === t.slot ? null : prev))}
            onListDragOver={(e) => e.preventDefault()}
            onListDrop={() => void handleDrop({ tableSlot: t.slot, gameId: t.gameId })}
            onCardDragOver={(memberId) => setCardDragOverId(memberId)}
            onCardDrop={(memberId) =>
              void handleDrop({ tableSlot: t.slot, gameId: t.gameId, beforeMemberId: memberId })
            }
          />
        ))}
      </div>
    </div>
  );
}

function GameStatsBar({
  session,
  timer,
  onRequestEndGame,
}: {
  session: GameSession;
  timer?: TableTimerState;
  onRequestEndGame?: (gameId: number) => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (timer?.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timer?.status]);

  const remaining = timer ? formatRemainingMs(getDisplayRemainingMs(timer, now)) : "--:--";
  const level = formatTimerLevelShort(timer, "—");

  return (
    <div className="table-guests__stats">
      <div className="table-guests__stats-group">
        <span className="table-guests__stats-item">
          <span className="table-guests__stats-label">레벨</span>
          <strong>{level}</strong>
        </span>
        <span className="table-guests__stats-item">
          <span className="table-guests__stats-label">시간</span>
          <strong className="table-guests__stats-time">{remaining}</strong>
        </span>
        <span className="table-guests__stats-item">
          <span className="table-guests__stats-label">엔트리</span>
          <strong>{session.entries}</strong>
        </span>
        {session.rebuys.map((count, i) => (
          <span key={i} className="table-guests__stats-item">
            <span className="table-guests__stats-label">
              {session.rebuyCount === 1 ? "리바인" : `${i + 1}차`}
            </span>
            <strong>{count}</strong>
          </span>
        ))}
      </div>
      {onRequestEndGame && (
        <button
          type="button"
          className="table-guests__end-game"
          onClick={() => onRequestEndGame(session.gameId)}
        >
          게임 종료
        </button>
      )}
    </div>
  );
}

type PanelProps = {
  tableSlot: TableSlot;
  session: GameSession;
  highlighted?: boolean;
  pending: boolean;
  drag: DragState | null;
  listDragOver: boolean;
  cardDragOverId: string | null;
  onError?: (msg: string) => void;
  onDragStart: (memberId: string) => void;
  onDragEnd: () => void;
  onListDragEnter: () => void;
  onListDragLeave: () => void;
  onListDragOver: (e: React.DragEvent) => void;
  onListDrop: () => void;
  onCardDragOver: (memberId: string) => void;
  onCardDrop: (memberId: string) => void;
};

function TableGuestPanel({
  tableSlot,
  session,
  highlighted,
  pending,
  drag,
  listDragOver,
  cardDragOverId,
  onError,
  onDragStart,
  onDragEnd,
  onListDragEnter,
  onListDragLeave,
  onListDragOver,
  onListDrop,
  onCardDragOver,
  onCardDrop,
}: PanelProps) {
  const [guests, setGuests] = useState<OnFloorGuest[]>([]);
  const [guestsError, setGuestsError] = useState<string | null>(null);
  const [localPending, setLocalPending] = useState(false);

  const refreshGuests = useCallback(async () => {
    const res = await window.controlApi.listOnFloorGuests();
    if (res.ok) {
      setGuests(res.guests);
      setGuestsError(null);
    } else {
      setGuests([]);
      setGuestsError(res.error);
      onError?.(res.error);
    }
  }, [onError]);

  useEffect(() => {
    void refreshGuests();
  }, [refreshGuests]);

  const participants = session.participants ?? [];
  const registeredIds = new Set(participants.map((p) => p.memberId));
  const tableParticipants = participantsAtTable(session, tableSlot);
  const availableGuests = guests.filter((g) => !registeredIds.has(g.memberId));
  const isBusy = pending || localPending;
  const crossTableDrop =
    drag != null && (drag.fromTableSlot !== tableSlot || drag.gameId !== session.gameId);

  async function addGuest(guest: OnFloorGuest) {
    setLocalPending(true);
    const res = await window.controlApi.addParticipant({
      gameId: session.gameId,
      memberId: guest.memberId,
      nickname: guest.nickname,
      visitId: guest.visitId,
      tableSlot,
    });
    setLocalPending(false);
    if (!res.ok) onError?.(res.error);
  }

  async function sitOut(memberId: string) {
    setLocalPending(true);
    const res = await window.controlApi.sitOutParticipant(session.gameId, memberId, true);
    setLocalPending(false);
    if (!res.ok) onError?.(res.error);
  }

  async function changeRebuy(memberId: string, delta: number) {
    setLocalPending(true);
    const res = await window.controlApi.setParticipantRebuy(session.gameId, memberId, delta);
    setLocalPending(false);
    if (!res.ok) onError?.(res.error);
  }

  return (
    <section
      className={`table-guests__panel${highlighted ? " table-guests__panel--highlight" : ""}${listDragOver && crossTableDrop ? " table-guests__panel--drop-target" : ""}`}
    >
      <header className="table-guests__head">
        <h2 className="table-guests__title">
          {tableName(tableSlot)} · G{session.gameId} {session.structureName}
        </h2>
        <span className="table-guests__count">{tableParticipants.length}명</span>
      </header>

      <div
        className={`table-guests__list${listDragOver ? " table-guests__list--drag-over" : ""}`}
        onDragEnter={onListDragEnter}
        onDragLeave={onListDragLeave}
        onDragOver={onListDragOver}
        onDrop={(e) => {
          e.preventDefault();
          onListDrop();
        }}
      >
        {tableParticipants.length === 0 ? (
          <p className="muted table-guests__empty">
            {drag && drag.gameId === session.gameId ? "여기에 놓기" : "등록된 손님이 없습니다."}
          </p>
        ) : (
          tableParticipants.map((p) => (
            <GuestCard
              key={p.memberId}
              participant={p}
              pending={isBusy}
              dragging={drag?.memberId === p.memberId}
              dragOver={cardDragOverId === p.memberId && drag?.memberId !== p.memberId}
              onDragStart={() => onDragStart(p.memberId)}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (drag?.memberId !== p.memberId) onCardDragOver(p.memberId);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCardDrop(p.memberId);
              }}
              onDragEnd={onDragEnd}
              onSitOut={() => void sitOut(p.memberId)}
              onRebuy={(delta) => void changeRebuy(p.memberId, delta)}
            />
          ))
        )}
      </div>

      <div className="table-guests__floor">
        <h3 className="table-guests__floor-title">출석 손님</h3>
        {guestsError ? (
          <p className="error table-guests__floor-error">{guestsError}</p>
        ) : availableGuests.length === 0 ? (
          <p className="muted">추가할 출석 손님이 없습니다.</p>
        ) : (
          <ul className="table-guests__floor-list">
            {availableGuests.map((g) => (
              <li key={g.visitId} className="table-guests__floor-item">
                <span>{g.nickname}</span>
                <button
                  type="button"
                  className="table-guests__add-btn"
                  disabled={isBusy}
                  onClick={() => void addGuest(g)}
                >
                  추가
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type CardProps = {
  participant: GameParticipant;
  pending: boolean;
  dragging: boolean;
  dragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSitOut: () => void;
  onRebuy: (delta: number) => void;
};

function GuestCard({
  participant,
  pending,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSitOut,
  onRebuy,
}: CardProps) {
  const active = !participant.sitOut;
  return (
    <div
      className={`guest-card${active ? " guest-card--active" : " guest-card--sitout"}${dragging ? " guest-card--dragging" : ""}${dragOver ? " guest-card--drag-over" : ""}`}
      draggable={!pending}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span className="guest-card__handle" aria-hidden>
        ⠿
      </span>
      <div className="guest-card__main">
        <span className="guest-card__name">{participant.nickname}</span>
        <div className="guest-card__rebuy">
          <span className="guest-card__rebuy-label">리바인</span>
          <button
            type="button"
            className="guest-card__rebuy-btn"
            disabled={pending || participant.rebuyCount <= 0}
            onClick={() => onRebuy(-1)}
          >
            −
          </button>
          <span className="guest-card__rebuy-count">{participant.rebuyCount}</span>
          <button
            type="button"
            className="guest-card__rebuy-btn"
            disabled={pending}
            onClick={() => onRebuy(1)}
          >
            +
          </button>
        </div>
      </div>
      {active ? (
        <button type="button" className="guest-card__sitout" disabled={pending} onClick={onSitOut}>
          싯아웃
        </button>
      ) : (
        <span className="guest-card__sitout-badge">싯아웃</span>
      )}
    </div>
  );
}
