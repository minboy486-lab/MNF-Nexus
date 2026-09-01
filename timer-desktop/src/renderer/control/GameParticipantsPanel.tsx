import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameSession, TableSlot } from "../../shared/types";
import { tableLetter } from "../../shared/types";
import type { OnFloorGuest } from "../../preload/control";
import type { GameParticipant } from "../../shared/participants";

type Props = {
  session: GameSession;
  venueId?: string | null;
  onError?: (msg: string) => void;
};

export function GameParticipantsPanel({ session, onError }: Props) {
  const [guests, setGuests] = useState<OnFloorGuest[]>([]);
  const [activeTable, setActiveTable] = useState<TableSlot | "all">("all");
  const [pending, setPending] = useState(false);

  const tableTabs = useMemo((): (TableSlot | "all")[] => {
    if (session.tableIds.length > 0) return [...session.tableIds];
    return ["all"];
  }, [session.tableIds]);

  useEffect(() => {
    if (activeTable !== "all" && !session.tableIds.includes(activeTable as TableSlot)) {
      setActiveTable(session.tableIds[0] ?? "all");
    }
  }, [activeTable, session.tableIds]);

  const refreshGuests = useCallback(async () => {
    const res = await window.controlApi.listOnFloorGuests();
    if (res.ok) setGuests(res.guests);
    else onError?.(res.error);
  }, [onError]);

  useEffect(() => {
    void refreshGuests();
  }, [refreshGuests]);

  const participants = session.participants ?? [];
  const registeredIds = new Set(participants.map((p) => p.memberId));

  const visibleParticipants = participants.filter((p) => {
    if (activeTable === "all") return true;
    return p.tableSlot === activeTable;
  });

  const availableGuests = guests.filter((g) => !registeredIds.has(g.memberId));

  async function addGuest(guest: OnFloorGuest) {
    setPending(true);
    const tableSlot = activeTable === "all" ? null : activeTable;
    const res = await window.controlApi.addParticipant({
      gameId: session.gameId,
      memberId: guest.memberId,
      nickname: guest.nickname,
      visitId: guest.visitId,
      tableSlot,
    });
    setPending(false);
    if (!res.ok) onError?.(res.error);
  }

  async function removeGuest(memberId: string) {
    setPending(true);
    const res = await window.controlApi.removeParticipant(session.gameId, memberId);
    setPending(false);
    if (!res.ok) onError?.(res.error);
  }

  return (
    <div className="participants-panel">
      <div className="participants-panel__head">
        <h3 className="participants-panel__title">참가 손님 · {session.dailyGameNo}게임</h3>
        <span className="participants-panel__count">{participants.length}명</span>
      </div>

      <div className="participants-tabs">
        {tableTabs.map((tab) => (
          <button
            key={String(tab)}
            type="button"
            className={`participants-tabs__btn${activeTable === tab ? " participants-tabs__btn--active" : ""}`}
            onClick={() => setActiveTable(tab === "all" ? "all" : tab)}
          >
            {tab === "all" ? "전체" : `${tableLetter(tab)} 테이블`}
          </button>
        ))}
      </div>

      <div className="participants-grid">
        <div className="participants-col">
          <h4 className="participants-col__title">등록됨</h4>
          {visibleParticipants.length === 0 ? (
            <p className="muted">아직 없습니다.</p>
          ) : (
            <ul className="participants-list">
              {visibleParticipants.map((p) => (
                <ParticipantRow key={p.memberId} p={p} onRemove={() => void removeGuest(p.memberId)} pending={pending} />
              ))}
            </ul>
          )}
        </div>
        <div className="participants-col">
          <h4 className="participants-col__title">출석 손님</h4>
          {availableGuests.length === 0 ? (
            <p className="muted">추가할 출석 손님이 없습니다.</p>
          ) : (
            <ul className="participants-list">
              {availableGuests.map((g) => (
                <li key={g.visitId} className="participants-list__item">
                  <span>{g.nickname}</span>
                  <button type="button" className="participants-list__add" disabled={pending} onClick={() => void addGuest(g)}>
                    추가
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ParticipantRow({
  p,
  onRemove,
  pending,
}: {
  p: GameParticipant;
  onRemove: () => void;
  pending: boolean;
}) {
  return (
    <li className="participants-list__item">
      <span>
        {p.nickname}
        {p.tableSlot ? <span className="muted"> · {tableLetter(p.tableSlot)}</span> : null}
      </span>
      <button type="button" className="participants-list__remove" disabled={pending} onClick={onRemove}>
        제거
      </button>
    </li>
  );
}
