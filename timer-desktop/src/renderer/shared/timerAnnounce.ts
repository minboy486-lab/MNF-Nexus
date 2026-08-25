import { useEffect, useRef } from "react";
import type { BlindLevelDef, TableTimerState } from "@mnf/timer/types";
import { getDisplayRemainingMs } from "@mnf/timer/engine";
import srcChime from "./sounds/chime.wav";
import srcBlindUpVoice from "./sounds/blind-up-voice.wav";
import srcBlindUp1min from "./sounds/blind-up-1min.wav";
import srcBreakStart1min from "./sounds/break-start-1min.wav";
import srcBreakEnd1min from "./sounds/break-end-1min.wav";
import srcBreakStart from "./sounds/break-start.wav";

const ONE_MIN_MS = 60_000;
const LEVEL_EPS = 1e-6;

type Clip =
  | "chime"
  | "blindUpVoice"
  | "blindUp1min"
  | "breakStart1min"
  | "breakEnd1min"
  | "breakStart";

const CLIP_SRC: Record<Clip, string> = {
  chime: srcChime,
  blindUpVoice: srcBlindUpVoice,
  blindUp1min: srcBlindUp1min,
  breakStart1min: srcBreakStart1min,
  breakEnd1min: srcBreakEnd1min,
  breakStart: srcBreakStart,
};

let sinkId: string | undefined;
let current: HTMLAudioElement | null = null;
let playGen = 0;
/** HTMLAudioElement.volume, 0–1 */
let soundGain = 1;

export function setTimerSoundVolume(percent: number): void {
  const n = typeof percent === "number" ? percent : Number(percent);
  const pct = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 100;
  soundGain = pct / 100;
  if (soundGain <= 0.001) {
    stopCurrent();
    return;
  }
  if (current) current.volume = soundGain;
}

export function playTimerVolumePreview(): void {
  if (soundGain <= 0.001) return;
  void playClips(["chime"], false);
}

function isBreakDef(level: Pick<BlindLevelDef, "small" | "big">): boolean {
  return level.small === 0 && level.big === 0;
}

function isBreakState(state: TableTimerState): boolean {
  return state.smallBlind === 0 && state.bigBlind === 0 && !!state.blindStructureId;
}

function sortedLevels(state: TableTimerState): BlindLevelDef[] {
  return state.levels.slice().sort((a, b) => a.level - b.level);
}

function nextLevelDef(state: TableTimerState): BlindLevelDef | null {
  const list = sortedLevels(state);
  const idx = list.findIndex((l) => Math.abs(l.level - state.blindLevel) < LEVEL_EPS);
  if (idx < 0) return list.find((l) => l.level > state.blindLevel) ?? null;
  return list[idx + 1] ?? null;
}

function scoreDevice(deviceLabel: string, displayLabel: string): number {
  const device = deviceLabel.toLowerCase();
  const display = displayLabel.toLowerCase().trim();
  if (!device || !display) return 0;
  if (device.includes(display) || display.includes(device)) return 100;
  const tokens = display.split(/[\s\-_/()[\]]+/).filter((t) => t.length >= 3);
  let score = 0;
  for (const t of tokens) {
    if (device.includes(t)) score += t.length;
  }
  return score;
}

async function refreshSink(displayLabel: string): Promise<void> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(
      (d) => d.kind === "audiooutput" && d.deviceId && d.deviceId !== "communications",
    );
    let bestId: string | undefined;
    let best = 0;
    for (const d of outputs) {
      if (d.deviceId === "default") continue;
      const s = scoreDevice(d.label, displayLabel);
      if (s > best) {
        best = s;
        bestId = d.deviceId;
      }
    }
    sinkId = best >= 4 ? bestId : undefined;
  } catch {
    sinkId = undefined;
  }
}

function displayLabel(): string {
  const api = (window as Window & { displayApi?: { getDisplayLabel?: () => string } }).displayApi;
  return api?.getDisplayLabel?.() ?? "";
}

function stopCurrent(): void {
  if (!current) return;
  current.pause();
  current.currentTime = 0;
  current = null;
}

function playOne(src: string, matchDisplayAudio: boolean, gen: number): Promise<void> {
  return new Promise((resolve) => {
    if (gen !== playGen) {
      resolve();
      return;
    }
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = soundGain;
    current = audio;
    const finish = () => {
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", finish);
      if (current === audio) current = null;
      resolve();
    };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);

    const start = async () => {
      try {
        if (matchDisplayAudio && sinkId && "setSinkId" in audio) {
          await (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
        }
      } catch {
        /* default device */
      }
      if (gen !== playGen) {
        finish();
        return;
      }
      try {
        await audio.play();
      } catch {
        finish();
      }
    };
    void start();
  });
}

async function playClips(clips: Clip[], matchDisplayAudio: boolean): Promise<void> {
  if (soundGain <= 0.001) return;
  const gen = ++playGen;
  if (matchDisplayAudio && !sinkId) {
    await refreshSink(displayLabel());
  }
  stopCurrent();
  for (const clip of clips) {
    if (gen !== playGen) return;
    await playOne(CLIP_SRC[clip], matchDisplayAudio, gen);
  }
}

type Prev = {
  primed: boolean;
  tableId: number | null;
  level: number | null;
  remainingMs: number;
};

type Options = {
  /** 송출 창: HDMI 모니터 오디오로 라우팅. 컨트롤 미리보기는 false */
  matchDisplayAudio?: boolean;
};

export function useTimerAnnounce(
  state: TableTimerState | null | undefined,
  remainingMs: number,
  options?: Options,
): void {
  const matchDisplayAudio = options?.matchDisplayAudio === true;
  const prevRef = useRef<Prev>({
    primed: false,
    tableId: null,
    level: null,
    remainingMs: 0,
  });

  useEffect(() => {
    if (!matchDisplayAudio) return;
    const label = displayLabel();
    void refreshSink(label);
    const onChange = () => {
      void refreshSink(label);
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
    };
  }, [matchDisplayAudio]);

  useEffect(() => {
    const prev = prevRef.current;
    if (!state?.blindStructureId) {
      prevRef.current = { primed: false, tableId: null, level: null, remainingMs: 0 };
      return;
    }

    const level = state.blindLevel;
    const rem = Number.isFinite(remainingMs) ? remainingMs : getDisplayRemainingMs(state);
    const breakNow = isBreakState(state);

    if (!prev.primed || prev.tableId !== state.tableId) {
      prevRef.current = { primed: true, tableId: state.tableId, level, remainingMs: rem };
      return;
    }

    if (level > (prev.level ?? level)) {
      if (breakNow) {
        void playClips(["breakStart"], matchDisplayAudio);
      } else {
        void playClips(["chime", "blindUpVoice"], matchDisplayAudio);
      }
    } else if (state.status === "running" && rem <= ONE_MIN_MS && prev.remainingMs > ONE_MIN_MS) {
      if (breakNow) {
        void playClips(["breakEnd1min"], matchDisplayAudio);
      } else {
        const next = nextLevelDef(state);
        void playClips(
          next && isBreakDef(next) ? ["breakStart1min"] : ["blindUp1min"],
          matchDisplayAudio,
        );
      }
    }

    prevRef.current = { primed: true, tableId: state.tableId, level, remainingMs: rem };
  }, [state, remainingMs, matchDisplayAudio]);
}
