import type { GameSession } from "./types";
import type { TableTimerState } from "@mnf/timer/types";
import { REMOTE_PORT } from "./remote";

export const LAN_GAMES_PATH = "/lan/games";
export { REMOTE_PORT as LAN_VIEW_PORT };

export type LanGameInfo = {
  gameId: number;
  structureName: string;
  status: TableTimerState["status"];
  blindLevel: number;
  smallBlind: number;
  bigBlind: number;
  remainingMs: number;
};

export type LanHostGames = {
  ok: true;
  host: string;
  hostname: string;
  theme?: string;
  soundVolume?: number;
  games: LanGameInfo[];
};

export type LanDiscoveredGame = LanGameInfo & {
  host: string;
  hostname: string;
  theme?: string;
  soundVolume?: number;
};

export type LanViewState = {
  host: string;
  hostname: string;
  gameId: number;
  structureName: string;
  timer: TableTimerState | null;
  session: GameSession | null;
  theme?: string;
  soundVolume?: number;
  serverNow?: number;
};

/** 상대 PC의 endsAt을 이 컴퓨터 시계로 옮겨, 남은 시간이 같아지게 한다. */
export function rebaseLanTimer(
  timer: TableTimerState,
  serverNow: number,
  localNow = Date.now(),
): TableTimerState {
  if (timer.status !== "running" || timer.endsAt == null || !Number.isFinite(serverNow)) {
    return timer;
  }
  const remaining = Math.max(0, timer.endsAt - serverNow);
  return { ...timer, endsAt: localNow + remaining };
}

/** TOTAL TIME이 상대 PC 시계를 따라가지 않도록 구간 시작 시각을 맞춘다. */
export function rebaseLanSession(
  session: GameSession,
  serverNow: number,
  localNow = Date.now(),
): GameSession {
  if (!Number.isFinite(serverNow)) return session;
  const delta = localNow - serverNow;
  return {
    ...session,
    startedAt: session.startedAt ? session.startedAt + delta : session.startedAt,
    totalRunningAt: session.totalRunningAt ? session.totalRunningAt + delta : null,
  };
}
