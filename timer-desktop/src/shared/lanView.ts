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
