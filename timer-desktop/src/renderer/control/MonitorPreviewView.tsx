import { useEffect, useState } from "react";
import type { TableTimerState } from "@mnf/timer/types";
import type { GameSession, UiThemeId } from "../../shared/types";
import type { TimerLook } from "../../shared/timerLook";
import logoDisplayUrl from "./mnf-logo-display.png";
import { BroadcastStage } from "../shared/BroadcastStage";
import { useTimerAnnounce } from "../shared/timerAnnounce";

type Props = {
  slot: number;
  session: GameSession | null;
  timerState: TableTimerState | null;
  timerTheme: UiThemeId;
  timerLook?: TimerLook | null;
};

export function MonitorPreviewView({ slot, session, timerState, timerTheme, timerLook = null }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const isRunning = timerState?.status === "running";
  const ms = timerState
    ? isRunning && timerState.endsAt
      ? Math.max(0, timerState.endsAt - Date.now())
      : timerState.remainingMs ?? 0
    : 0;
  useTimerAnnounce(timerState, ms);

  return (
    <div className="mpreview-shell">
      <BroadcastStage
        theme={timerTheme}
        look={timerLook}
        session={session}
        state={timerState}
        logoUrl={logoDisplayUrl}
        idleSlot={slot}
      />
      <p className="mpreview-hint">ESC — 돌아가기</p>
    </div>
  );
}
