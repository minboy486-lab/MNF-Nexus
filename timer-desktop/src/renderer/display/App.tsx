import { useEffect, useState } from "react";
import type { TableTimerState } from "@mnf/timer/types";
import { formatRemainingMs, getDisplayRemainingMs } from "@mnf/timer/engine";
import type { GameSession } from "../../shared/types";
import logoUrl from "./mnf-logo.png";

export function App() {
  const [monitorSlot, setMonitorSlot] = useState(1);
  const [state, setState] = useState<TableTimerState | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setMonitorSlot(window.displayApi.getMonitorSlot());
    const unsubTimer = window.displayApi.onTimerUpdate(setState);
    const unsubSession = window.displayApi.onSessionUpdate?.(setSession) ?? (() => {});
    return () => { unsubTimer(); unsubSession(); };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = state ? getDisplayRemainingMs(state) : 0;
  const isRunning = state?.status === "running";
  const isPaused  = state?.status === "paused";
  const hasGame   = !!state?.blindStructureId;

  const timerText = !hasGame || state?.status === "stopped"
    ? "--:--"
    : formatRemainingMs(remainingMs);

  // 다음 레벨 (break 포함, level 번호 순서대로 바로 다음)
  const currentLevel = state?.blindLevel ?? 1;
  const sortedLevels = state?.levels ? [...state.levels].sort((a,b) => a.level - b.level) : [];
  const currentIdx = sortedLevels.findIndex((l) => l.level === currentLevel);
  const nextLevel = currentIdx >= 0 ? (sortedLevels[currentIdx + 1] ?? null) : null;
  const isBreakLevel = (state?.bigBlind ?? -1) === 0 && (state?.smallBlind ?? -1) === 0 && !!state?.blindStructureId;

  // 칩 계산
  const totalRebuy = session ? session.rebuys.reduce((a, b) => a + b, 0) : 0;
  const totalChip = session
    ? session.entries * session.entryChip
      + session.rebuys.reduce((sum, cnt, i) => sum + cnt * (session.rebuyChips[i] ?? 0), 0)
      + session.addon * session.addonChip
      + session.bonusChip * session.bonusChipAmount
    : 0;
  const avgChip = session && session.players > 0
    ? Math.round(totalChip / session.players)
    : 0;

  // 총 경과 시간 (세션 startedAt 기준)
  const startedAt = session?.startedAt;
  const totalElapsedSec = (startedAt && isFinite(startedAt))
    ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    : 0;
  const elapsedH = Math.floor(totalElapsedSec / 3600);
  const elapsedM = Math.floor((totalElapsedSec % 3600) / 60);
  const elapsedS = totalElapsedSec % 60;
  const totalTimeText = (startedAt && isFinite(startedAt))
    ? `${String(elapsedH).padStart(2,"0")}:${String(elapsedM).padStart(2,"0")}:${String(elapsedS).padStart(2,"0")}`
    : "—";

  // 다음 브레이크까지 남은 시간 계산
  // break 레벨 = small===0 && big===0
  const nextBreakText = (() => {
    if (!state?.levels) return "—";
    const levels = state.levels;
    // 현재 레벨부터 다음 break 레벨까지 남은 총 시간(ms)
    // 현재 레벨 남은 시간 + 그 이후 레벨들의 durationSec 합산
    let secSum = Math.ceil(remainingMs / 1000);
    let foundBreak = false;
    for (const lv of levels) {
      if (lv.level <= currentLevel) continue; // 현재 레벨 이후만
      if (lv.small === 0 && lv.big === 0) { foundBreak = true; break; }
      secSum += lv.durationSec;
    }
    if (!foundBreak) return "—";
    const h = Math.floor(secSum / 3600);
    const m = Math.floor((secSum % 3600) / 60);
    const s = secSum % 60;
    if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  })();

  function fmtChip(n: number) {
    return n.toLocaleString();
  }

  return (
    <div className={`ds${isRunning ? " ds--running" : ""}${isPaused ? " ds--paused" : ""}${!hasGame ? " ds--idle" : ""}`}>
      <div className="ds-glow ds-glow--a" />
      <div className="ds-glow ds-glow--b" />
      <img src={logoUrl} className="ds-bg-logo" alt="" aria-hidden="true" />

      {!hasGame ? (
        <div className="ds-idle">
          <p className="ds-idle__text">대기 중</p>
          <p className="ds-idle__sub">M{monitorSlot}</p>
        </div>
      ) : (
        <>
          {/* 게임 이름 — 상단 중앙 고정 */}
          <div className="ds-title-bar">
            <p className="ds-game-name">{state?.blindStructureName ?? "MNF HOLDEM"}</p>
          </div>

          <div className="ds-layout">

          {/* ── 좌측 패널 (추후 내용 추가) ── */}
          <aside className="ds-left">
            <p className="ds-left__placeholder" />
          </aside>

          {/* ── 중앙 패널 ── */}
          <main className="ds-center">
            {/* 레벨 */}
            <p className="ds-level">{isBreakLevel ? "BREAK" : `LEVEL ${state?.blindLevel ?? 1}`}</p>

            {/* 타이머 */}
            <p className={`ds-timer${isRunning ? " ds-timer--running" : ""}${isPaused ? " ds-timer--paused" : ""}`}>
              {timerText}
            </p>

            {/* 현재 블라인드 / 브레이크 */}
            {isBreakLevel ? (
              <div className="ds-blinds">
                <span className="ds-blinds__val ds-blinds__val--break">BREAK TIME</span>
              </div>
            ) : (
              <div className="ds-blinds">
                <span className="ds-blinds__label">BLINDS</span>
                <span className="ds-blinds__val">
                  {(state?.smallBlind ?? 0).toLocaleString()} / {(state?.bigBlind ?? 0).toLocaleString()}
                </span>
                {(state?.ante ?? 0) > 0 && (
                  <>
                    <span className="ds-blinds__sep">·</span>
                    <span className="ds-blinds__label">ANTE</span>
                    <span className="ds-blinds__val">{(state?.ante ?? 0).toLocaleString()}</span>
                  </>
                )}
              </div>
            )}

            {/* 다음 레벨 */}
            {nextLevel && (
              <div className="ds-next">
                {nextLevel.big === 0 ? (
                  <>
                    <span className="ds-next__label">NEXT</span>
                    <span className="ds-next__val">BREAK ({Math.round(nextLevel.durationSec / 60)}min)</span>
                  </>
                ) : (
                  <>
                    <span className="ds-next__label">NEXT  LV.{nextLevel.level}</span>
                    <span className="ds-next__val">
                      {nextLevel.small.toLocaleString()} / {nextLevel.big.toLocaleString()}
                      {nextLevel.ante > 0 && <span className="ds-next__ante">  ·  Ante {nextLevel.ante.toLocaleString()}</span>}
                    </span>
                  </>
                )}
              </div>
            )}
          </main>

          {/* ── 우측 패널 ── */}
          <aside className="ds-right">
            <Stat label="TOTAL TIME" value={totalTimeText} mono />
            <div className="ds-right__div" />
            <Stat label="PLAYER" value={`${session?.players ?? 0} / ${session?.entries ?? 0}`} highlight />
            <div className="ds-right__div" />
            <Stat label="ENTRY" value={String(session?.entries ?? 0)} />
            <Stat label="REBUY" value={String(totalRebuy)} />
            <div className="ds-right__div" />
            <Stat label="TOTAL CHIP" value={fmtChip(totalChip)} />
            <Stat label="AVG CHIP"   value={fmtChip(avgChip)} />
            <div className="ds-right__div" />
            <Stat label="NEXT BREAK" value={nextBreakText} muted={nextBreakText === "—"} />
          </aside>

        </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight, muted, mono }: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="ds-stat">
      <span className="ds-stat__label">{label}</span>
      <span className={`ds-stat__val${highlight ? " ds-stat__val--hi" : ""}${muted ? " ds-stat__val--muted" : ""}${mono ? " ds-stat__val--mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
