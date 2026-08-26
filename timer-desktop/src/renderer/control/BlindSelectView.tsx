import { useEffect, useState } from "react";
import type { BlindStructureOption, TableTimerState } from "@mnf/timer/types";
import { formatRemainingMs, getDisplayRemainingMs } from "@mnf/timer/engine";
import type { GameSession } from "../../shared/types";
import type { LanDiscoveredGame } from "../../shared/lanView";

type Props = {
  options: BlindStructureOption[];
  loading: boolean;
  pending: boolean;
  localSessions: GameSession[];
  timers: TableTimerState[];
  onBack: () => void;
  onSelect: (structure: BlindStructureOption) => void;
  onRefresh: () => void;
  onPickLocalGame: (gameId: number) => void;
  onPickLanGame: (game: LanDiscoveredGame) => void;
};

function statusLabel(status: TableTimerState["status"] | undefined): string {
  if (!status || status === "stopped") return "정지";
  if (status === "running") return "진행";
  return "일시정지";
}

export function BlindSelectView({
  options,
  loading,
  pending,
  localSessions,
  timers,
  onBack,
  onSelect,
  onRefresh,
  onPickLocalGame,
  onPickLanGame,
}: Props) {
  const [localBlinds, setLocalBlinds] = useState<BlindStructureOption[]>([]);
  const [showLocal, setShowLocal] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [lanGames, setLanGames] = useState<LanDiscoveredGame[]>([]);
  const [lanLoading, setLanLoading] = useState(false);

  useEffect(() => {
    window.controlApi.listLocalBlinds().then((local) => {
      setLocalBlinds(local);
    }).catch(() => {});
  }, []);

  const displayed = (showLocal || (!loading && options.length === 0 && localBlinds.length > 0))
    ? localBlinds
    : options;

  async function handleShowLocal() {
    setShowGames(false);
    setShowLocal(true);
    setLocalLoading(true);
    const local = await window.controlApi.listLocalBlinds();
    setLocalBlinds(local);
    setLocalLoading(false);
  }

  async function handleShowGames() {
    setShowLocal(false);
    setShowGames(true);
    setLanLoading(true);
    try {
      const found = await window.controlApi.discoverLanGames();
      setLanGames(found);
    } catch {
      setLanGames([]);
    } finally {
      setLanLoading(false);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBack();
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && !pending) {
        if (showGames) {
          const local = localSessions[n - 1];
          if (local) {
            onPickLocalGame(local.gameId);
            return;
          }
          const lan = lanGames[n - 1 - localSessions.length];
          if (lan) onPickLanGame(lan);
          return;
        }
        const opt = displayed[n - 1];
        if (opt) onSelect(opt);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [displayed, pending, onSelect, onBack, showGames, localSessions, lanGames, onPickLocalGame, onPickLanGame]);

  return (
    <section className="sub-panel">
      <button type="button" className="back-btn" onClick={onBack}>
        ← 뒤로
      </button>

      <div className="sub-panel__head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 className="sub-panel__title">
            {showGames ? "진행중인 게임" : showLocal ? "로컬 저장 목록" : "블라인드 선택"}
          </h2>
          <button
            type="button"
            className={`blind-refresh-btn${loading || lanLoading || localLoading ? " blind-refresh-btn--spinning" : ""}`}
            onClick={() => {
              if (showGames) void handleShowGames();
              else if (showLocal) void handleShowLocal();
              else onRefresh();
            }}
            disabled={loading || lanLoading || localLoading}
            title="새로고침"
          >
            ↻
          </button>
        </div>
        <div className="blind-head-btns">
          <div className="blind-tabs" role="tablist" aria-label="목록 전환">
            <button
              type="button"
              role="tab"
              aria-selected={!showGames && !showLocal}
              className={`blind-tab${!showGames && !showLocal ? " active" : ""}`}
              onClick={() => {
                setShowGames(false);
                setShowLocal(false);
              }}
            >
              블라인드 선택
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showGames}
              className={`blind-tab${showGames ? " active" : ""}`}
              onClick={() => void handleShowGames()}
            >
              진행중인 게임
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showLocal && !showGames}
              className={`blind-tab${showLocal && !showGames ? " active" : ""}`}
              onClick={() => void handleShowLocal()}
            >
              로컬 저장 목록
            </button>
          </div>
          <button
            type="button"
            className="blind-edit-btn"
            onClick={() => window.controlApi.openExternal("https://mnf-nexus.vercel.app/admin/presets")}
          >
            ＋ 블라인드 추가 / 편집
          </button>
        </div>
      </div>

      {showGames ? (
        <>
          {(lanLoading) && <p className="muted">같은 네트워크에서 게임을 찾는 중...</p>}
          {!lanLoading && localSessions.length === 0 && lanGames.length === 0 && (
            <p className="muted" style={{ marginTop: 16 }}>
              진행 중인 게임이 없습니다. 이 컴퓨터나 같은 와이파이의 다른 타이머에서 게임을 시작한 뒤 다시 눌러 주세요.
            </p>
          )}
          {localSessions.length > 0 && (
            <>
              <p className="lan-games__label">이 컴퓨터</p>
              <ul className="blind-list">
                {localSessions.map((session, i) => {
                  const timer = timers.find((t) => t.tableId === session.gameId);
                  const key = i < 9 ? i + 1 : null;
                  return (
                    <li key={`local-${session.gameId}`}>
                      <button
                        type="button"
                        className="blind-card"
                        disabled={pending}
                        onClick={() => onPickLocalGame(session.gameId)}
                      >
                        {key && <span className="blind-card__key">{key}</span>}
                        <div className="blind-card__body">
                          <strong>G{session.gameId} · {session.structureName}</strong>
                          <span className="muted">
                            {statusLabel(timer?.status)}
                            {timer && (timer.status === "running" || timer.status === "paused")
                              ? ` · ${formatRemainingMs(getDisplayRemainingMs(timer))}`
                              : ""}
                            {timer ? ` · L${timer.blindLevel} ${timer.smallBlind}/${timer.bigBlind}` : ""}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {lanGames.length > 0 && (
            <>
              <p className="lan-games__label">같은 네트워크</p>
              <ul className="blind-list">
                {lanGames.map((game, i) => {
                  const idx = localSessions.length + i;
                  const key = idx < 9 ? idx + 1 : null;
                  return (
                    <li key={`${game.host}-${game.gameId}`}>
                      <button
                        type="button"
                        className="blind-card"
                        disabled={pending}
                        onClick={() => onPickLanGame(game)}
                      >
                        {key && <span className="blind-card__key">{key}</span>}
                        <div className="blind-card__body">
                          <strong>G{game.gameId} · {game.structureName}</strong>
                          <span className="muted">
                            {game.hostname} · {statusLabel(game.status)}
                            {game.status === "running" || game.status === "paused"
                              ? ` · ${formatRemainingMs(game.remainingMs)}`
                              : ""}
                            {` · L${game.blindLevel} ${game.smallBlind}/${game.bigBlind}`}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      ) : (
        <>
          {(loading || localLoading) && <p className="muted">불러오는 중...</p>}

          {!loading && !localLoading && displayed.length === 0 && (
            <p className="muted" style={{ marginTop: 16 }}>
              블라인드 구조를 불러올 수 없습니다. 인터넷 연결을 확인하거나 로컬 저장 목록을 시도해 주세요.
            </p>
          )}

          {showLocal && !localLoading && localBlinds.length === 0 && (
            <p className="muted" style={{ marginTop: 8 }}>
              로컬에 저장된 블라인드가 없습니다. 온라인에서 한 번 불러오면 자동으로 저장됩니다.
            </p>
          )}

          <ul className="blind-list">
            {displayed.map((opt, i) => {
              const key = i < 9 ? i + 1 : null;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    className="blind-card"
                    disabled={pending}
                    onClick={() => onSelect(opt)}
                  >
                    {key && <span className="blind-card__key">{key}</span>}
                    <div className="blind-card__body">
                      <strong>{opt.name}</strong>
                      <span className="muted">
                        바이인 {opt.defaultBuyIn.toLocaleString("ko-KR")} · {opt.levels.length}레벨
                        &nbsp;·&nbsp;L1 {opt.levels[0]?.small}/{opt.levels[0]?.big}
                        &nbsp;·&nbsp;{Math.round((opt.levels[0]?.durationSec ?? 0) / 60)}분
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

    </section>
  );
}
