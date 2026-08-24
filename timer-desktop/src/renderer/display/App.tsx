import { useEffect, useState } from "react";
import type { TableTimerState } from "@mnf/timer/types";
import { formatNextBreakRemaining, formatRemainingMs, getDisplayRemainingMs } from "@mnf/timer/engine";
import type { GameSession } from "../../shared/types";
import {
  applyDocumentTheme,
  formatTotalElapsedMs,
  getSessionTotalElapsedMs,
  normalizeUiTheme,
  noticeHtmlIsEmpty,
  sanitizeNoticeHtml,
} from "../../shared/types";
import logoUrl from "./mnf-logo.png";
import { DsBlinds } from "../shared/DsBlinds";
import { useTimerAnnounce } from "../shared/timerAnnounce";

export function App() {
  const [monitorSlot, setMonitorSlot] = useState(1);
  const [state, setState] = useState<TableTimerState | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setMonitorSlot(window.displayApi.getMonitorSlot());
    const unsubTimer = window.displayApi.onTimerUpdate(setState);
    const unsubSession = window.displayApi.onSessionUpdate?.(setSession) ?? (() => {});
    const unsubTheme = window.displayApi.onThemeUpdate((t) => {
      applyDocumentTheme(normalizeUiTheme(t));
    });
    void window.displayApi.getTheme().then((t) => {
      applyDocumentTheme(normalizeUiTheme(t));
    });
    return () => { unsubTimer(); unsubSession(); unsubTheme(); };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = state ? getDisplayRemainingMs(state) : 0;
  useTimerAnnounce(state, remainingMs, { matchDisplayAudio: true });
  const isRunning = state?.status === "running";
  const isPaused = state?.status === "paused";
  const hasGame = !!state?.blindStructureId;

  const timerText = !hasGame || state?.status === "stopped"
    ? "--:--"
    : formatRemainingMs(remainingMs);

  const currentLevel = state?.blindLevel ?? 1;
  const sortedLevels = state?.levels ? [...state.levels].sort((a, b) => a.level - b.level) : [];
  const currentIdx = sortedLevels.findIndex((l) => l.level === currentLevel);
  const nextLevel = currentIdx >= 0 ? (sortedLevels[currentIdx + 1] ?? null) : null;
  const isBreakLevel = (state?.bigBlind ?? -1) === 0 && (state?.smallBlind ?? -1) === 0 && !!state?.blindStructureId;

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

  const totalTimeText = session?.startedAt
    ? formatTotalElapsedMs(getSessionTotalElapsedMs(session))
    : "—";

  const nextBreakText = formatNextBreakRemaining(state?.levels, currentLevel, remainingMs);

  function fmtChip(n: number) {
    return n.toLocaleString();
  }

  return (
    <div className="ds-shell">
      <div className={`ds-root ds${isRunning ? " ds--running" : ""}${isPaused ? " ds--paused" : ""}${!hasGame ? " ds--idle" : ""}`}>
        <div className="ds-stage">
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
              <div className="ds-title-bar">
                <p className="ds-game-name">{state?.blindStructureName ?? "MNF HOLDEM"}</p>
              </div>

              <div className="ds-layout">
                <aside className="ds-left">
                  {session?.leftNotice && !noticeHtmlIsEmpty(session.leftNotice.html) ? (
                    <div
                      className="ds-left__notice-html"
                      dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(session.leftNotice.html) }}
                    />
                  ) : (
                    <p className="ds-left__placeholder" />
                  )}
                </aside>

                <main className="ds-center">
                  <p className="ds-level">{isBreakLevel ? "BREAK" : `LEVEL ${state?.blindLevel ?? 1}`}</p>
                  <p className={`ds-timer${isRunning ? " ds-timer--running" : ""}${isPaused ? " ds-timer--paused" : ""}`}>
                    {timerText}
                  </p>
                  {isBreakLevel ? (
                    <DsBlinds isBreak small={0} big={0} ante={0} />
                  ) : (
                    <DsBlinds
                      small={state?.smallBlind ?? 0}
                      big={state?.bigBlind ?? 0}
                      ante={state?.ante ?? 0}
                    />
                  )}
                  {nextLevel && (
                    <div className="ds-next">
                      {nextLevel.big === 0 ? (
                        <>
                          <span className="ds-next__label">NEXT</span>
                          <span className="ds-next__val">BREAK ({Math.round(nextLevel.durationSec / 60)}min)</span>
                        </>
                      ) : (
                        <>
                          <span className="ds-next__label">NEXT LV.{nextLevel.level}</span>
                          <span className="ds-next__val">
                            {nextLevel.small.toLocaleString()} / {nextLevel.big.toLocaleString()}
                            {nextLevel.ante > 0 && (
                              <span className="ds-next__ante"> · Ante {nextLevel.ante.toLocaleString()}</span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </main>

                <aside className="ds-right">
                  <Stat label="TOTAL TIME" value={totalTimeText} mono />
                  <div className="ds-right__div" />
                  <Stat label="PLAYER" value={`${session?.players ?? 0} / ${session?.entries ?? 0}`} highlight />
                  <div className="ds-right__div" />
                  <Stat label="ENTRY" value={String(session?.entries ?? 0)} />
                  <Stat label="REBUY" value={String(totalRebuy)} />
                  <div className="ds-right__div" />
                  <Stat label="TOTAL CHIP" value={fmtChip(totalChip)} />
                  <Stat label="AVG CHIP" value={fmtChip(avgChip)} />
                  <div className="ds-right__div" />
                  <Stat label="NEXT BREAK" value={nextBreakText} muted={nextBreakText === "—"} />
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
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
