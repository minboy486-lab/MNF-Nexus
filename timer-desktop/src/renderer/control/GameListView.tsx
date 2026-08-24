import type { AppSnapshot, GameSession } from "../../shared/types";
import type { TableTimerState } from "@mnf/timer/types";
import { formatRemainingMs, getDisplayRemainingMs } from "@mnf/timer/engine";

type Props = {
  snapshot: AppSnapshot;
  timers: TableTimerState[];
  onSelectGame: (session: GameSession) => void;
  onNewGame: () => void;
};

function statusLabel(status: TableTimerState["status"] | undefined): string {
  if (!status || status === "stopped") return "정지";
  if (status === "running") return "진행";
  return "일시정지";
}

export function GameListView({ snapshot, timers, onSelectGame, onNewGame }: Props) {
  const sessions = snapshot.sessions;

  return (
    <div className="game-list">
      <div className="game-list__header">
        <span className="game-list__title">게임 ({sessions.length})</span>
        <button type="button" className="btn-new-game" onClick={onNewGame}>
          + 새 게임 <span className="btn-new-game__key">N</span>
        </button>
      </div>

      {sessions.length === 0 && (
        <p className="muted game-list__empty">진행 중인 게임이 없습니다.</p>
      )}

      <ul className="game-list__items">
        {sessions.map((session, idx) => {
          const timer = timers.find((t) => t.tableId === session.gameId);
          const remainingMs = timer ? getDisplayRemainingMs(timer) : 0;
          const isRunning = timer?.status === "running";

          const fKey = idx < 6 ? `F${idx + 1}` : null;
          const isBreak =
            !!timer?.blindStructureId && timer.smallBlind === 0 && timer.bigBlind === 0;
          const levelLabel = isBreak ? "BREAK" : String(timer?.blindLevel ?? 1);
          const rebuyTotal = session.rebuys.reduce((a, b) => a + b, 0);
          return (
            <li key={session.gameId} className={`game-card${isRunning ? " game-card--running" : ""}`} onClick={() => onSelectGame(session)}>
              <div className="game-card__id">
                G{session.gameId}
                {fKey && <span className="game-card__fkey">{fKey}</span>}
              </div>
              <div className="game-card__info">
                <span className="game-card__name">{session.structureName}</span>
                <span className="game-card__status">
                  <span className={`dot dot--${timer?.status ?? "stopped"}`} />
                  {statusLabel(timer?.status)}
                </span>
              </div>
              <div className="game-card__stats">
                <span className="game-card__stat">
                  <span className="game-card__stat-label">엔트리</span>
                  <span className="game-card__stat-val">{session.entries}</span>
                </span>
                <span className="game-card__stat">
                  <span className="game-card__stat-label">리바인</span>
                  <span className="game-card__stat-val">{rebuyTotal}</span>
                </span>
                <span className="game-card__pair">
                  <span className="game-card__stat">
                    <span className="game-card__stat-label">레벨</span>
                    <span className="game-card__stat-val">{levelLabel}</span>
                  </span>
                  <span className="game-card__stat">
                    <span className="game-card__stat-label">시간</span>
                    <span className="game-card__stat-val game-card__timer">
                      {isRunning || timer?.status === "paused"
                        ? formatRemainingMs(remainingMs)
                        : "—"}
                    </span>
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
