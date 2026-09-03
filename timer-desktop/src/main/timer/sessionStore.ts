import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import type { TableTimerState } from "@mnf/timer/types";
import type { GameSession, MonitorSlot, TableSlot } from "../../shared/types";
import { MONITOR_SLOTS } from "../../shared/types";
import { normalizeGameSession } from "../../shared/participants";

export const HUB_SESSION_VERSION = 1;

export type PersistedHubState = {
  version: number;
  savedAt: number;
  nextGameId: number;
  sessions: GameSession[];
  timers: TableTimerState[];
  monitorAssignments: Record<number, number | null>;
  tableAssignments: Record<number, number | null>;
};

export function getHubSessionPath(): string {
  return join(app.getPath("userData"), "hub-session.json");
}

function isTimerStatus(v: unknown): v is TableTimerState["status"] {
  return v === "running" || v === "paused" || v === "stopped";
}

function normalizeTimer(raw: unknown): TableTimerState | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.tableId !== "number" || !isTimerStatus(t.status)) return null;
  if (!Array.isArray(t.levels)) return null;
  return {
    tableId: t.tableId,
    status: t.status,
    blindLevel: typeof t.blindLevel === "number" ? t.blindLevel : 1,
    endsAt: typeof t.endsAt === "number" ? t.endsAt : null,
    remainingMs: typeof t.remainingMs === "number" ? t.remainingMs : null,
    smallBlind: typeof t.smallBlind === "number" ? t.smallBlind : 0,
    bigBlind: typeof t.bigBlind === "number" ? t.bigBlind : 0,
    ante: typeof t.ante === "number" ? t.ante : 0,
    pauseKind: (t.pauseKind as TableTimerState["pauseKind"]) ?? null,
    blindStructureId: typeof t.blindStructureId === "string" ? t.blindStructureId : null,
    blindStructureName: typeof t.blindStructureName === "string" ? t.blindStructureName : null,
    levels: t.levels as TableTimerState["levels"],
    muteLevelAnnounce: Boolean(t.muteLevelAnnounce),
  };
}

function normalizeAssignments(
  raw: unknown,
  slots: readonly number[],
): Record<number, number | null> {
  const out: Record<number, number | null> = {};
  for (const slot of slots) out[slot] = null;
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const slot of slots) {
    const v = obj[String(slot)] ?? obj[slot as unknown as string];
    out[slot] = typeof v === "number" ? v : null;
  }
  return out;
}

/** 디스크 저장용: running 타이머는 remainingMs로 고정해 재시작 후에도 남은 시간이 맞게 복원되게 한다. */
export function serializeHubState(input: {
  nextGameId: number;
  sessions: GameSession[];
  timers: TableTimerState[];
  monitorAssignments: Record<number, number | null>;
  tableAssignments: Record<number, number | null>;
  now?: number;
}): PersistedHubState {
  const now = input.now ?? Date.now();
  const timers = input.timers.map((t) => {
    if (t.status === "running" && t.endsAt != null) {
      return {
        ...t,
        remainingMs: Math.max(0, t.endsAt - now),
        endsAt: null,
      };
    }
    return { ...t };
  });

  const sessions = input.sessions.map((s) => {
    const session = normalizeGameSession({ ...s });
    if (session.totalRunningAt) {
      session.totalElapsedMs += Math.max(0, now - session.totalRunningAt);
      session.totalRunningAt = null;
    }
    return session;
  });

  return {
    version: HUB_SESSION_VERSION,
    savedAt: now,
    nextGameId: Math.max(1, input.nextGameId),
    sessions,
    timers,
    monitorAssignments: { ...input.monitorAssignments },
    tableAssignments: { ...input.tableAssignments },
  };
}

/** 로드 직후: running 타이머의 endsAt을 현재 시각 기준으로 다시 잡는다. */
export function hydratePersistedTimers(
  timers: TableTimerState[],
  sessions: GameSession[],
  now = Date.now(),
): { timers: TableTimerState[]; sessions: GameSession[] } {
  const nextTimers = timers.map((t) => {
    if (t.status !== "running") return t;
    const remaining = typeof t.remainingMs === "number" ? Math.max(0, t.remainingMs) : 0;
    return {
      ...t,
      endsAt: now + remaining,
      remainingMs: null,
    };
  });

  const runningIds = new Set(
    nextTimers.filter((t) => t.status === "running").map((t) => t.tableId),
  );
  const nextSessions = sessions.map((s) => {
    const session = normalizeGameSession({ ...s });
    if (runningIds.has(session.gameId)) {
      session.totalRunningAt = now;
    } else {
      session.totalRunningAt = null;
    }
    return session;
  });

  return { timers: nextTimers, sessions: nextSessions };
}

export function loadHubState(): PersistedHubState | null {
  const path = getHubSessionPath();
  try {
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<PersistedHubState>;
    if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.timers)) return null;

    const sessions = parsed.sessions
      .filter((s): s is GameSession => !!s && typeof (s as GameSession).gameId === "number")
      .map((s) => normalizeGameSession(s));
    const timers = parsed.timers.map(normalizeTimer).filter((t): t is TableTimerState => t != null);

    const tableSlots = [1, 2, 3, 4, 5, 6] as const;
    return {
      version: typeof parsed.version === "number" ? parsed.version : HUB_SESSION_VERSION,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      nextGameId: typeof parsed.nextGameId === "number" && parsed.nextGameId >= 1 ? parsed.nextGameId : 1,
      sessions,
      timers,
      monitorAssignments: normalizeAssignments(parsed.monitorAssignments, MONITOR_SLOTS),
      tableAssignments: normalizeAssignments(parsed.tableAssignments, tableSlots),
    };
  } catch (err) {
    console.error("[hub-session] load failed", err);
    return null;
  }
}

export function saveHubState(state: PersistedHubState): void {
  const path = getHubSessionPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2), "utf8");
}

export function clearHubState(): void {
  const path = getHubSessionPath();
  try {
    if (existsSync(path)) writeFileSync(path, "", "utf8");
  } catch {
    /* ignore */
  }
}

export type HydratedHubMaps = {
  nextGameId: number;
  sessions: Map<number, GameSession>;
  timers: Map<number, TableTimerState>;
  monitorAssignments: Map<MonitorSlot, number | null>;
  tableAssignments: Map<TableSlot, number | null>;
};

export function toHubMaps(state: PersistedHubState, now = Date.now()): HydratedHubMaps {
  const { timers, sessions } = hydratePersistedTimers(state.timers, state.sessions, now);

  const sessionMap = new Map<number, GameSession>();
  for (const s of sessions) sessionMap.set(s.gameId, s);

  const timerMap = new Map<number, TableTimerState>();
  for (const t of timers) {
    if (sessionMap.has(t.tableId)) timerMap.set(t.tableId, t);
  }

  // 세션만 있고 타이머가 없으면 해당 세션 제외
  for (const id of [...sessionMap.keys()]) {
    if (!timerMap.has(id)) sessionMap.delete(id);
  }

  const monitorAssignments = new Map<MonitorSlot, number | null>();
  for (const slot of MONITOR_SLOTS) {
    const gid = state.monitorAssignments[slot] ?? null;
    monitorAssignments.set(slot, gid != null && sessionMap.has(gid) ? gid : null);
  }

  const tableAssignments = new Map<TableSlot, number | null>();
  for (let t = 1; t <= 6; t++) {
    const slot = t as TableSlot;
    const gid = state.tableAssignments[t] ?? null;
    tableAssignments.set(slot, gid != null && sessionMap.has(gid) ? gid : null);
  }

  const maxId = Math.max(0, ...sessionMap.keys(), ...timerMap.keys());
  const nextGameId = Math.max(state.nextGameId, maxId + 1);

  return {
    nextGameId,
    sessions: sessionMap,
    timers: timerMap,
    monitorAssignments,
    tableAssignments,
  };
}
