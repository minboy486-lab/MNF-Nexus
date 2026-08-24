import { useEffect, useState } from "react";
import type { TableTimerState } from "@mnf/timer/types";
import { formatNextBreakRemaining } from "@mnf/timer/engine";
import type { GameSession } from "../../shared/types";
import { formatTotalElapsedMs, getSessionTotalElapsedMs, noticeHtmlIsEmpty, sanitizeNoticeHtml } from "../../shared/types";
import logoDisplayUrl from "./mnf-logo-display.png";
import { DsBlinds } from "../shared/DsBlinds";
import { useTimerAnnounce } from "../shared/timerAnnounce";

type Props = {
  slot: number;
  session: GameSession | null;
  timerState: TableTimerState | null;
};

export function MonitorPreviewView({ slot, session, timerState }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const isRunning = timerState?.status === "running";
  const isPaused = timerState?.status === "paused";
  const hasGame = !!timerState?.blindStructureId;
  const ms = timerState
    ? isRunning && timerState.endsAt
      ? Math.max(0, timerState.endsAt - Date.now())
      : timerState.remainingMs ?? 0
    : 0;
  useTimerAnnounce(timerState, ms);

  const sec = Math.ceil(ms / 1000);
  const timeStr =
    !timerState || timerState.status === "stopped"
      ? "--:--"
      : `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  const currentLevel = timerState?.blindLevel ?? 1;
  const mpSortedLevels = timerState?.levels ? [...timerState.levels].sort((a, b) => a.level - b.level) : [];
  const mpCurIdx = mpSortedLevels.findIndex((l) => l.level === currentLevel);
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
  const nextBreakText = formatNextBreakRemaining(timerState?.levels, currentLevel, ms);
  const mpTotalTimeText = session?.startedAt
    ? formatTotalElapsedMs(getSessionTotalElapsedMs(session))
    : "—";

  function fmtChip(n: number) {
    return n.toLocaleString();
  }

  return (
    <div className="mpreview-shell">
      <div
        className={`ds${isRunning ? " ds--running" : ""}${isPaused ? " ds--paused" : ""}${!hasGame ? " ds--idle" : ""}`}
      >
        <div className="ds-stage">
          <div className="ds-glow ds-glow--a" />
          <div className="ds-glow ds-glow--b" />
          <img src={logoDisplayUrl} className="ds-bg-logo" alt="" aria-hidden="true" />

          {!hasGame ? (
            <div className="ds-idle">
              <p className="ds-idle__text">대기 중</p>
              <p className="ds-idle__sub">M{slot}</p>
            </div>
          ) : (
            <>
              <div className="ds-title-bar">
                <p className="ds-game-name">{timerState?.blindStructureName ?? "MNF HOLDEM"}</p>
              </div>
              <div className="ds-layout">
                <aside className="ds-left">
                  {session?.leftNotice && !noticeHtmlIsEmpty(session.leftNotice.html) ? (
                    <div
                      className="ds-left__notice-html"
                      dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(session.leftNotice.html) }}
                    />
                  ) : null}
                </aside>
                <main className="ds-center">
                  <p className="ds-level">{mpIsBreak ? "BREAK" : `LEVEL ${timerState?.blindLevel ?? 1}`}</p>
                  <p className={`ds-timer${isRunning ? " ds-timer--running" : ""}${isPaused ? " ds-timer--paused" : ""}`}>
                    {timeStr}
                  </p>
                  {mpIsBreak ? (
                    <DsBlinds isBreak small={0} big={0} ante={0} />
                  ) : (
                    <DsBlinds
                      small={timerState?.smallBlind ?? 0}
                      big={timerState?.bigBlind ?? 0}
                      ante={timerState?.ante ?? 0}
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
                  <MpStat label="TOTAL TIME" value={mpTotalTimeText} />
                  <div className="ds-right__div" />
                  <MpStat label="PLAYER" value={`${session?.players ?? 0} / ${session?.entries ?? 0}`} hi />
                  <div className="ds-right__div" />
                  <MpStat label="ENTRY" value={String(session?.entries ?? 0)} />
                  <MpStat label="REBUY" value={String(totalRebuy)} />
                  <div className="ds-right__div" />
                  <MpStat label="TOTAL CHIP" value={fmtChip(totalChip)} />
                  <MpStat label="AVG CHIP" value={fmtChip(avgChip)} />
                  <div className="ds-right__div" />
                  <MpStat label="NEXT BREAK" value={nextBreakText} muted={nextBreakText === "—"} />
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="mpreview-hint">ESC — 돌아가기</p>
    </div>
  );
}

function MpStat({ label, value, hi, muted }: { label: string; value: string; hi?: boolean; muted?: boolean }) {
  return (
    <div className="ds-stat">
      <span className="ds-stat__label">{label}</span>
      <span className={`ds-stat__val${hi ? " ds-stat__val--hi" : ""}${muted ? " ds-stat__val--muted" : ""}`}>
        {value}
      </span>
    </div>
  );
}
