import { useCallback, useEffect, useState } from "react";
import type { BlindStructureOption, TableTimerState } from "@mnf/timer/types";
import type { AppConfig, AppSnapshot, DisplayInfo, GameSession } from "../../shared/types";
import { AssignPopup } from "./AssignPopup";
import { BlindSelectView } from "./BlindSelectView";
import { FloorPlanView } from "./FloorPlanView";
import { GameControlView } from "./GameControlView";
import { GameListView } from "./GameListView";
import { SetupScreen } from "./SetupScreen";
import logoDisplayUrl from "./mnf-logo-display.png";

type View =
  | { kind: "main" }
  | { kind: "blind-select" }
  | { kind: "game-control"; session: GameSession }
  | { kind: "monitor-preview"; slot: number }
  | { kind: "setup" };

type Popup =
  | { kind: "table"; slot: number; pos: { x: number; y: number } }
  | { kind: "monitor"; slot: number; pos: { x: number; y: number } }
  | null;

const EMPTY_SNAPSHOT: AppSnapshot = {
  sessions: [],
  monitorAssignments: {},
  tableAssignments: {},
};

export function App() {
  const [view, setView] = useState<View>({ kind: "main" });
  const [popup, setPopup] = useState<Popup>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quitConfirm, setQuitConfirm] = useState(false);

  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);
  const [timers, setTimers] = useState<TableTimerState[]>([]);
  const [blinds, setBlinds] = useState<BlindStructureOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [blindsLoading, setBlindsLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [disp, cfg, snap] = await Promise.all([
        window.controlApi.getDisplays(),
        window.controlApi.getConfig(),
        window.controlApi.getSnapshot(),
      ]);
      setDisplays(disp);
      setConfig(cfg);
      setSnapshot(snap);
      if (!cfg) setView({ kind: "setup" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const unsubSetup = window.controlApi.onSetupRequired(() => setView({ kind: "setup" }));
    const unsubSnap = window.controlApi.onSnapshot(setSnapshot);
    const unsubTimers = window.controlApi.onTimerUpdate(setTimers);

    return () => {
      unsubSetup();
      unsubSnap();
      unsubTimers();
    };
  }, [refresh]);

  // ESC → 뒤로가기 / M → 선택된 모니터 미리보기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 종료 확인 단축키
      if (quitConfirm) {
        if (e.key === "Escape" || e.key === "2" || e.key === "n" || e.key === "N") { setQuitConfirm(false); return; }
        if (e.key === "1" || e.key === "y" || e.key === "Y") { window.controlApi.quit(); return; }
        return;
      }

      if (e.key === "Escape") {
        if (settingsOpen) { setSettingsOpen(false); return; }
        if (popup) { setPopup(null); return; }
        if (view.kind !== "main") { setView({ kind: "main" }); return; }
        // main 화면에서 ESC → 설정 메뉴
        setSettingsOpen(true);
        return;
      }

      // 설정 메뉴 숫자 단축키
      if (settingsOpen) {
        const menuActions: (() => void)[] = [
          () => { setSettingsOpen(false); setView({ kind: "setup" }); },   // 1: 모니터 설정
          () => { setSettingsOpen(false); setQuitConfirm(true); },          // 2: 프로그램 종료
        ];
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < menuActions.length) {
          e.preventDefault();
          menuActions[idx]();
        }
        return;
      }

      if ((e.key === "m" || e.key === "M" || e.key === "ㅡ") && view.kind === "main") {
        // 모니터 팝업이 열려있으면 전체화면 미리보기로 전환
        if (popup?.kind === "monitor") {
          const slot = popup.slot;
          setPopup(null);
          setView({ kind: "monitor-preview", slot });
          return;
        }
      }
      // 미리보기 화면에서도 M 키로 닫기
      if ((e.key === "m" || e.key === "M" || e.key === "ㅡ") && view.kind === "monitor-preview") {
        setView({ kind: "main" });
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, popup, settingsOpen, quitConfirm]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── 플로어 단축키 (main 뷰 + 팝업 없을 때) ───────────────────
  useEffect(() => {
    // 영문 → 슬롯 매핑
    const MONITOR_KEYS: Record<string, number> = { q:5, a:3, z:1, r:6, f:4, v:2 };
    const TABLE_KEYS:   Record<string, number> = { w:5, s:3, x:1, e:6, d:4, c:2 };
    const NEW_GAME_KEYS = new Set(["n", "ㅜ"]);

    // 한글 → 영문 변환표 (두벌식)
    const KO_TO_EN: Record<string, string> = {
      ㅂ:"q", ㅈ:"w", ㄷ:"e", ㄱ:"r", ㅅ:"t", ㅛ:"y", ㅕ:"u", ㅑ:"i", ㅐ:"o", ㅔ:"p",
      ㅁ:"a", ㄴ:"s", ㅇ:"d", ㄹ:"f", ㅎ:"g", ㅗ:"h", ㅓ:"j", ㅏ:"k", ㅣ:"l",
      ㅋ:"z", ㅌ:"x", ㅊ:"c", ㅍ:"v", ㅠ:"b", ㅜ:"n", ㅡ:"m",
    };

    /** 버튼 중심 좌표 반환 */
    function slotPos(selector: string): { x: number; y: number } {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (view.kind !== "main") return;
      if (popup || settingsOpen || quitConfirm) return;

      // 한글이면 영문으로 변환
      const raw = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const key = KO_TO_EN[raw] ?? raw;

      // 새 게임
      if (NEW_GAME_KEYS.has(key) || key === "n") {
        setView({ kind: "blind-select" });
        return;
      }

      // 게임 선택 (F1~F6)
      if (e.key.startsWith("F") && /^F[1-6]$/.test(e.key)) {
        const idx = parseInt(e.key.slice(1), 10) - 1;
        const session = snapshot.sessions[idx];
        if (session) {
          e.preventDefault();
          setView({ kind: "game-control", session });
        }
        return;
      }

      // 모니터 버튼
      if (key in MONITOR_KEYS) {
        const slot = MONITOR_KEYS[key];
        const pos = slotPos(`[data-slot="monitor-${slot}"]`);
        setPopup({ kind: "monitor", slot, pos });
        return;
      }

      // 테이블 버튼
      if (key in TABLE_KEYS) {
        const slot = TABLE_KEYS[key];
        const pos = slotPos(`[data-slot="table-${slot}"]`);
        setPopup({ kind: "table", slot, pos });
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, popup, settingsOpen, quitConfirm, snapshot]);

  // ── 게임 생성 ───────────────────────────────────────────────

  async function openBlindSelect(): Promise<void> {
    setBlinds([]);
    setBlindsLoading(true);
    setView({ kind: "blind-select" });

    try {
      // 로컬 캐시 먼저
      const local = await window.controlApi.listLocalBlinds();
      console.log("[App] local:", local.length);
      if (local.length > 0) {
        setBlinds(local);
        setBlindsLoading(false);
      }
    } catch (e) {
      console.error("[App] local 에러:", e);
    }

    // 원격 갱신 (6초 타임아웃)
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000));
      const list = await Promise.race([window.controlApi.listBlinds(), timeout]);
      console.log("[App] remote:", list.length);
      if (list.length > 0) setBlinds(list);
    } catch (e) {
      console.warn("[App] remote 실패/타임아웃:", e);
    } finally {
      setBlindsLoading(false);
    }
  }

  async function handleCreateGame(structure: BlindStructureOption): Promise<void> {
    setPending(true);
    setError(null);
    const result = await window.controlApi.createGame(structure);
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    setView({ kind: "game-control", session: result.session });
  }

  // ── 게임 삭제 ───────────────────────────────────────────────

  async function handleDeleteGame(gameId: number): Promise<void> {
    setPending(true);
    await window.controlApi.deleteGame(gameId);
    setPending(false);
    setView({ kind: "main" });
  }

  // ── 타이머 조작 ─────────────────────────────────────────────

  async function handleCommand(
    gameId: number,
    action: Parameters<typeof window.controlApi.timerCommand>[1],
    options?: { minutes?: number; ms?: number; sec?: number },
  ): Promise<void> {
    setPending(true);
    setError(null);
    const result = await window.controlApi.timerCommand(gameId, action, options);
    setPending(false);
    if (!result.ok) setError(result.error);
  }

  // ── 테이블/모니터 연결 ──────────────────────────────────────

  async function handleAssignTable(tableSlot: number, gameId: number | null): Promise<void> {
    await window.controlApi.assignTable(tableSlot, gameId);
    setPopup(null);
  }

  async function handleAssignMonitor(monitorSlot: number, gameId: number | null): Promise<void> {
    await window.controlApi.assignMonitor(monitorSlot, gameId);
    setPopup(null);
  }

  // ── 렌더 ────────────────────────────────────────────────────

  const currentSession =
    view.kind === "game-control"
      ? snapshot.sessions.find((s) => s.gameId === view.session.gameId) ?? view.session
      : null;

  return (
    <div className="shell compact">
      {view.kind !== "monitor-preview" && (
        <header className="shell-header compact-header">
          <div className="header-brand">
            <img src="./mnf-logo.png" alt="MNF" className="header-logo" />
            <span className="header-title">
              {view.kind === "setup"
                ? "모니터 설정"
                : view.kind === "blind-select"
                  ? "블라인드 선택"
                  : view.kind === "game-control"
                    ? `Game ${currentSession?.gameId}`
                    : "매장 컨트롤"}
            </span>
          </div>
          {view.kind === "main" && (
            <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)}>
              ⚙
            </button>
          )}
        </header>
      )}

      {loading && <p className="muted pad">불러오는 중...</p>}

      {!loading && view.kind === "main" && (
        <>
          <FloorPlanView
            snapshot={snapshot}
            onTableClick={(slot, pos) => setPopup({ kind: "table", slot, pos })}
            onMonitorClick={(slot, pos) => setPopup({ kind: "monitor", slot, pos })}
          />
          <GameListView
            snapshot={snapshot}
            timers={timers}
            onSelectGame={(session) => setView({ kind: "game-control", session })}
            onNewGame={() => void openBlindSelect()}
          />
        </>
      )}

      {!loading && view.kind === "blind-select" && (
        <BlindSelectView
          options={blinds}
          loading={blindsLoading}
          pending={pending}
          onBack={() => setView({ kind: "main" })}
          onSelect={(s) => void handleCreateGame(s)}
          onOpenSettings={() => setSettingsOpen(true)}
          onRefresh={() => void openBlindSelect()}
        />
      )}

      {!loading && view.kind === "game-control" && currentSession && (
        <GameControlView
          session={currentSession}
          state={timers.find((t) => t.tableId === currentSession.gameId)}
          pending={pending}
          error={error}
          onBack={() => setView({ kind: "main" })}
          onCommand={(action, options) => void handleCommand(currentSession.gameId, action, options)}
          onDeleteGame={() => void handleDeleteGame(currentSession.gameId)}
        />
      )}

      {!loading && view.kind === "monitor-preview" && (() => {
        const slot = view.slot;
        const gameId = snapshot.monitorAssignments[slot] ?? null;
        const session = gameId !== null ? snapshot.sessions.find((s) => s.gameId === gameId) ?? null : null;
        const timerState = gameId !== null ? timers.find((t) => t.tableId === gameId) ?? null : null;
        const isRunning = timerState?.status === "running";
        const isPaused = timerState?.status === "paused";
        const hasGame = !!timerState?.blindStructureId;
        const ms = timerState
          ? isRunning && timerState.endsAt
            ? Math.max(0, timerState.endsAt - Date.now())
            : timerState.remainingMs ?? 0
          : 0;
        const sec = Math.ceil(ms / 1000);
        const timeStr = !timerState || timerState.status === "stopped"
          ? "--:--"
          : `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
        const currentLevel = timerState?.blindLevel ?? 1;
        const mpSortedLevels = timerState?.levels ? [...timerState.levels].sort((a,b) => a.level - b.level) : [];
        const mpCurIdx = mpSortedLevels.findIndex(l => l.level === currentLevel);
        const nextLevel = mpCurIdx >= 0 ? (mpSortedLevels[mpCurIdx + 1] ?? null) : null;
        const mpIsBreak = (timerState?.bigBlind ?? -1) === 0 && (timerState?.smallBlind ?? -1) === 0 && hasGame;
        const totalRebuy = session ? session.rebuys.reduce((a, b) => a + b, 0) : 0;
        const totalChip = session
          ? session.entries * session.entryChip
            + session.rebuys.reduce((sum, cnt, i) => sum + cnt * (session.rebuyChips[i] ?? 0), 0)
            + session.addon * session.addonChip
            + session.bonusChip * session.bonusChipAmount
          : 0;
        const avgChip = session && session.players > 0 ? Math.round(totalChip / session.players) : 0;
        function fmtChip(n: number) { return n.toLocaleString(); }
        // 다음 브레이크까지 남은 시간
        const nextBreakText = (() => {
          if (!timerState?.levels) return "—";
          let secSum = Math.ceil(ms / 1000);
          let found = false;
          for (const lv of timerState.levels) {
            if (lv.level <= currentLevel) continue;
            if (lv.small === 0 && lv.big === 0) { found = true; break; }
            secSum += lv.durationSec;
          }
          if (!found) return "—";
          const h = Math.floor(secSum / 3600);
          const m = Math.floor((secSum % 3600) / 60);
          const s = secSum % 60;
          if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
          return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
        })();
        // 경과 시간 (세션 startedAt 기준)
        const mpStartedAt = session?.startedAt;
        const mpElapsedSec = (mpStartedAt && isFinite(mpStartedAt))
          ? Math.max(0, Math.floor((Date.now() - mpStartedAt) / 1000))
          : 0;
        const mpTotalTimeText = (mpStartedAt && isFinite(mpStartedAt))
          ? `${String(Math.floor(mpElapsedSec / 3600)).padStart(2,"0")}:${String(Math.floor((mpElapsedSec % 3600) / 60)).padStart(2,"0")}:${String(mpElapsedSec % 60).padStart(2,"0")}`
          : "—";

        return (
          <div className={`mpreview-shell${isRunning ? " mpreview--running" : ""}${isPaused ? " mpreview--paused" : ""}`}>
            <div className="mpreview-glow mpreview-glow--a" />
            <div className="mpreview-glow mpreview-glow--b" />
            <img src={logoDisplayUrl} className="mpreview-bg-logo" alt="" aria-hidden="true" />

            {!hasGame ? (
              <div className="mpreview-idle-wrap">
                <p className="mpreview-idle">대기 중</p>
                <p className="mpreview-idle-sub">M{slot}</p>
              </div>
            ) : (
              <>
              <div className="mpreview-title-bar">
                <p className="mpreview-name">{timerState?.blindStructureName ?? "MNF HOLDEM"}</p>
              </div>

              <div className="mpreview-layout">
                {/* 좌측 */}
                <aside className="mpreview-left" />

                {/* 중앙 */}
                <main className="mpreview-center">
                  <p className="mpreview-level-badge">{mpIsBreak ? "BREAK" : `LEVEL ${timerState?.blindLevel ?? 1}`}</p>
                  <p className={`mpreview-timer${isRunning ? " mpreview-timer--running" : ""}${isPaused ? " mpreview-timer--paused" : ""}`}>
                    {timeStr}
                  </p>
                  {mpIsBreak ? (
                    <div className="mpreview-blinds-row">
                      <span className="mpreview-blinds-val mpreview-blinds-val--break">BREAK TIME</span>
                    </div>
                  ) : (
                    <div className="mpreview-blinds-row">
                      <span className="mpreview-blinds-label">BLINDS</span>
                      <span className="mpreview-blinds-val">
                        {(timerState?.smallBlind ?? 0).toLocaleString()} / {(timerState?.bigBlind ?? 0).toLocaleString()}
                      </span>
                      {(timerState?.ante ?? 0) > 0 && (
                        <>
                          <span className="mpreview-blinds-sep">·</span>
                          <span className="mpreview-blinds-label">ANTE</span>
                          <span className="mpreview-blinds-val">{(timerState?.ante ?? 0).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  )}
                  {nextLevel && (
                    <div className="mpreview-next">
                      {nextLevel.big === 0 ? (
                        <>
                          <span className="mpreview-next-label">NEXT</span>
                          <span className="mpreview-next-val">BREAK ({Math.round(nextLevel.durationSec / 60)}min)</span>
                        </>
                      ) : (
                        <>
                          <span className="mpreview-next-label">NEXT LV.{nextLevel.level}</span>
                          <span className="mpreview-next-val">
                            {nextLevel.small.toLocaleString()} / {nextLevel.big.toLocaleString()}
                            {nextLevel.ante > 0 && <span className="mpreview-next-ante"> · Ante {nextLevel.ante.toLocaleString()}</span>}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </main>

                {/* 우측 */}
                <aside className="mpreview-right">
                  <MpStat label="TOTAL TIME" value={mpTotalTimeText} />
                  <div className="mpreview-div" />
                  <MpStat label="PLAYER" value={`${session?.players ?? 0} / ${session?.entries ?? 0}`} hi />
                  <div className="mpreview-div" />
                  <MpStat label="ENTRY" value={String(session?.entries ?? 0)} />
                  <MpStat label="REBUY" value={String(totalRebuy)} />
                  <div className="mpreview-div" />
                  <MpStat label="TOTAL CHIP" value={fmtChip(totalChip)} />
                  <MpStat label="AVG CHIP" value={fmtChip(avgChip)} />
                  <div className="mpreview-div" />
                  <MpStat label="NEXT BREAK" value={nextBreakText} muted={nextBreakText === "—"} />
                </aside>
              </div>
              </>
            )}

            <p className="mpreview-hint">ESC — 돌아가기</p>
          </div>
        );
      })()}

      {!loading && view.kind === "setup" && (
        <SetupScreen
          displays={displays}
          initialConfig={config}
          onSaved={(next) => {
            setConfig(next);
            setView({ kind: "main" });
          }}
        />
      )}

      {popup?.kind === "table" && (
        <AssignPopup
          title={`T${popup.slot} 게임 연결`}
          mousePos={popup.pos}
          currentGameId={snapshot.tableAssignments[popup.slot] ?? null}
          sessions={snapshot.sessions}
          onSelect={(gid) => void handleAssignTable(popup.slot, gid)}
          onClose={() => setPopup(null)}
        />
      )}

      {popup?.kind === "monitor" && (
        <AssignPopup
          title={`M${popup.slot} 게임 연결`}
          mousePos={popup.pos}
          currentGameId={snapshot.monitorAssignments[popup.slot] ?? null}
          sessions={snapshot.sessions}
          onSelect={(gid) => void handleAssignMonitor(popup.slot, gid)}
          onClose={() => setPopup(null)}
          hint="M — 전체화면 미리보기"
        />
      )}

      {/* 전체화면 모니터 미리보기 */}

      {settingsOpen && (() => {
        const menuItems: { label: string; variant?: string; action: () => void }[] = [
          { label: "모니터 설정", action: () => { setSettingsOpen(false); setView({ kind: "setup" }); } },
          { label: "프로그램 종료", variant: "danger", action: () => { setSettingsOpen(false); setQuitConfirm(true); } },
        ];
        return (
          <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
            <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
              <h3 className="settings-popup__title">설정</h3>
              {menuItems.map((item, i) => (
                <button
                  key={i}
                  className={`settings-popup__btn${item.variant ? ` settings-popup__btn--${item.variant}` : ""}`}
                  onClick={item.action}
                >
                  <span className="settings-popup__num">{i + 1}</span>
                  {item.label}
                </button>
              ))}
              <button
                className="settings-popup__btn settings-popup__btn--cancel"
                onClick={() => setSettingsOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        );
      })()}

      {quitConfirm && (
        <div className="settings-overlay">
          <div className="settings-popup">
            <h3 className="settings-popup__title">종료하시겠습니까?</h3>
            <div className="settings-popup__row">
              <button
                className="confirm-btn confirm-btn--yes"
                onClick={() => window.controlApi.quit()}
              >
                <span className="confirm-btn__key">1</span>
                YES
              </button>
              <button
                className="confirm-btn confirm-btn--no"
                onClick={() => setQuitConfirm(false)}
              >
                <span className="confirm-btn__key">2</span>
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MpStat({ label, value, hi, muted }: { label: string; value: string; hi?: boolean; muted?: boolean }) {
  return (
    <div className="mpreview-stat">
      <span className="mpreview-stat-label">{label}</span>
      <span className={`mpreview-stat-val${hi ? " mpreview-stat-val--hi" : ""}${muted ? " mpreview-stat-val--muted" : ""}`}>
        {value}
      </span>
    </div>
  );
}
