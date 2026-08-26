import { getLevelDef, getNextLevelDef, getPrevLevelDef, pauseKindOf, resolveLevels, sortedBlindLevels } from "./levels";
import type { BlindLevelDef, BlindStructureOption, TableTimerState, TimerAction, TimerStatus } from "./types";

export function createInitialTimerState(tableId: number): TableTimerState {
  return {
    tableId,
    status: "stopped",
    blindLevel: 1,
    endsAt: null,
    remainingMs: null,
    smallBlind: 0,
    bigBlind: 0,
    ante: 0,
    pauseKind: null,
    blindStructureId: null,
    blindStructureName: null,
    levels: [],
  };
}

export function openTableGame(tableId: number, structure: BlindStructureOption): TableTimerState {
  const first = sortedBlindLevels(structure.levels)[0];
  return {
    tableId,
    status: "stopped",
    blindLevel: first.level,
    endsAt: null,
    remainingMs: null,
    smallBlind: first.small,
    bigBlind: first.big,
    ante: first.ante,
    pauseKind: pauseKindOf(first),
    blindStructureId: structure.id,
    blindStructureName: structure.name,
    levels: structure.levels,
  };
}

export function getDisplayRemainingMs(state: TableTimerState, now = Date.now()): number {
  if (state.status === "running" && state.endsAt !== null) {
    return Math.max(0, state.endsAt - now);
  }
  if (state.status === "paused" && state.remainingMs !== null) {
    return Math.max(0, state.remainingMs);
  }
  return 0;
}

export function formatRemainingMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatNextBreakRemaining(
  levels: BlindLevelDef[] | undefined,
  currentLevel: number,
  remainingMs: number,
): string {
  if (!levels?.length) return "—";
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  let secSum = Math.ceil(remainingMs / 1000);
  let found = false;
  for (const lv of sorted) {
    if (lv.level <= currentLevel) continue;
    if (lv.small === 0 && lv.big === 0) {
      found = true;
      break;
    }
    secSum += lv.durationSec;
  }
  if (!found) return "—";
  const h = Math.floor(secSum / 3600);
  const m = Math.floor((secSum % 3600) / 60);
  const s = secSum % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function applyLevel(state: TableTimerState, levelNum: number): TableTimerState {
  const level = getLevelDef(state.levels, levelNum);
  return {
    ...state,
    blindLevel: level.level,
    smallBlind: level.small,
    bigBlind: level.big,
    ante: level.ante,
    pauseKind: pauseKindOf(level),
  };
}

function toRunning(state: TableTimerState, durationMs: number, now = Date.now()): TableTimerState {
  return {
    ...state,
    status: "running",
    endsAt: now + durationMs,
    remainingMs: null,
  };
}

function patchCurrentLevelDuration(state: TableTimerState, minutes: number): TableTimerState {
  const durationSec = Math.max(1, minutes) * 60;
  const levels = resolveLevels(state.levels).map((level) =>
    Math.abs(level.level - state.blindLevel) < 1e-6 ? { ...level, durationSec } : level,
  );
  return { ...state, levels };
}

export function applyTimerAction(
  state: TableTimerState,
  action: TimerAction,
  options?: { minutes?: number; ms?: number; sec?: number; muteLevelAnnounce?: boolean },
  now = Date.now(),
): TableTimerState {
  const level = getLevelDef(state.levels, state.blindLevel);

  switch (action) {
    case "start": {
      if (state.status === "running") return state;
      if (!state.blindStructureId) return state;
      if (state.status === "paused" && state.remainingMs !== null) {
        return toRunning(state, state.remainingMs, now);
      }
      return toRunning(applyLevel(state, state.blindLevel || 1), level.durationSec * 1000, now);
    }
    case "pause": {
      if (state.status !== "running" || state.endsAt === null) return state;
      return {
        ...state,
        status: "paused",
        remainingMs: Math.max(0, state.endsAt - now),
        endsAt: null,
      };
    }
    case "stop": {
      return {
        ...state,
        status: "stopped",
        endsAt: null,
        remainingMs: null,
      };
    }
    case "levelUp": {
      const next = getNextLevelDef(state.levels, state.blindLevel);
      if (!next) return state;
      const leveled = applyLevel(state, next.level);
      const mute = options?.muteLevelAnnounce === true;
      if (leveled.status === "running") {
        return { ...toRunning(leveled, next.durationSec * 1000, now), muteLevelAnnounce: mute };
      }
      if (leveled.status === "paused") {
        return { ...leveled, remainingMs: next.durationSec * 1000, muteLevelAnnounce: mute };
      }
      return { ...leveled, muteLevelAnnounce: mute };
    }
    case "levelDown": {
      const prev = getPrevLevelDef(state.levels, state.blindLevel);
      if (!prev) return state;
      const leveled = applyLevel(state, prev.level);
      const mute = options?.muteLevelAnnounce === true;
      if (leveled.status === "running") {
        return { ...toRunning(leveled, prev.durationSec * 1000, now), muteLevelAnnounce: mute };
      }
      if (leveled.status === "paused") {
        return { ...leveled, remainingMs: prev.durationSec * 1000, muteLevelAnnounce: mute };
      }
      return { ...leveled, muteLevelAnnounce: mute };
    }
    case "setDuration": {
      const minutes = options?.minutes;
      if (!minutes || minutes < 1) return state;
      const patched = patchCurrentLevelDuration(state, minutes);
      if (patched.status === "paused") {
        return { ...patched, remainingMs: minutes * 60 * 1000 };
      }
      return patched;
    }
    case "reset": {
      if (!state.blindStructureId) return createInitialTimerState(state.tableId);
      const first = sortedBlindLevels(state.levels)[0];
      return {
        ...state,
        status: "stopped" as TimerStatus,
        blindLevel: first.level,
        endsAt: null,
        remainingMs: null,
        smallBlind: first.small,
        bigBlind: first.big,
        ante: first.ante,
      };
    }
    case "setRemainingMs": {
      // 남은 시간을 ms 단위로 직접 지정 (일시정지 상태로 전환)
      const ms = options?.ms ?? 0;
      if (ms < 0) return state;
      return {
        ...state,
        status: "paused" as TimerStatus,
        remainingMs: ms,
        endsAt: null,
      };
    }
    case "adjustSec": {
      // 현재 남은 시간에 sec(+/-초) 더하기
      const delta = (options?.sec ?? 0) * 1000;
      const current = state.status === "running" && state.endsAt !== null
        ? Math.max(0, state.endsAt - now)
        : state.remainingMs ?? 0;
      const next = Math.max(0, current + delta);
      if (state.status === "running") {
        return { ...state, endsAt: now + next, remainingMs: null };
      }
      return { ...state, status: "paused" as TimerStatus, remainingMs: next, endsAt: null };
    }
    default:
      return state;
  }
}

export function closeTableGame(state: TableTimerState): TableTimerState {
  return createInitialTimerState(state.tableId);
}
