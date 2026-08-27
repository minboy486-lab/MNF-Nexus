import { useEffect, useState } from "react";
import type { TableTimerState } from "@mnf/timer/types";
import { getDisplayRemainingMs } from "@mnf/timer/engine";
import type { GameSession, UiThemeId } from "../../shared/types";
import { applyDocumentTheme, DEFAULT_UI_THEME, normalizeUiTheme } from "../../shared/types";
import type { TimerLook } from "../../shared/timerLook";
import { normalizeTimerLook } from "../../shared/timerLook";
import logoUrl from "./mnf-logo.png";
import { BroadcastStage } from "../shared/BroadcastStage";
import { useTimerAnnounce, setTimerSoundVolume } from "../shared/timerAnnounce";

export function App() {
  const [monitorSlot, setMonitorSlot] = useState(1);
  const [theme, setTheme] = useState<UiThemeId>(DEFAULT_UI_THEME);
  const [look, setLook] = useState<TimerLook | null>(null);
  const [state, setState] = useState<TableTimerState | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setMonitorSlot(window.displayApi.getMonitorSlot());
    const unsubTimer = window.displayApi.onTimerUpdate(setState);
    const unsubSession = window.displayApi.onSessionUpdate?.(setSession) ?? (() => {});
    const unsubTheme = window.displayApi.onThemeUpdate((t) => {
      const next = normalizeUiTheme(t);
      setTheme(next);
      applyDocumentTheme(next);
    });
    const unsubLook = window.displayApi.onTimerLookUpdate((next) => {
      setLook(normalizeTimerLook(next, theme));
    });
    const unsubVolume = window.displayApi.onSoundVolumeUpdate((v) => {
      setTimerSoundVolume(v);
    });
    void window.displayApi.getTheme().then((t) => {
      const next = normalizeUiTheme(t);
      setTheme(next);
      applyDocumentTheme(next);
    });
    void window.displayApi.getTimerLook().then((next) => {
      setLook(normalizeTimerLook(next, theme));
    });
    void window.displayApi.getSoundVolume().then(setTimerSoundVolume);
    return () => {
      unsubTimer();
      unsubSession();
      unsubTheme();
      unsubLook();
      unsubVolume();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = state ? getDisplayRemainingMs(state) : 0;
  useTimerAnnounce(state, remainingMs, { matchDisplayAudio: true });

  return (
    <div className="ds-shell">
      <BroadcastStage
        className="ds-root"
        theme={theme}
        look={look}
        session={session}
        state={state}
        logoUrl={logoUrl}
        idleSlot={monitorSlot}
      />
    </div>
  );
}
