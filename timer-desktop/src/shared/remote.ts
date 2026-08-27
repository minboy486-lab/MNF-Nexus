import type { AppSnapshot, GameSession, YeoksamRole } from "./types";
import type { ShopTimerThemePayload } from "./timerLook";
import type { TableTimerState, TimerAction, BlindStructureOption } from "@mnf/timer/types";

export const REMOTE_PORT = 17890;
export const LAN_CLUSTER_PATH = "/lan/cluster";
export const LAN_CLAIM_PATH = "/lan/claim";
export const PUNCH_TOKEN_TTL_MS = 3 * 60 * 1000;

export const REMOTE_TIMER_ACTIONS = [
  "start",
  "pause",
  "levelUp",
  "levelDown",
  "reset",
  "adjustSec",
] as const;

export type RemoteTimerAction = (typeof REMOTE_TIMER_ACTIONS)[number];

export type RemoteCounterOp =
  | "player+"
  | "player-"
  | "entry+"
  | "entry-"
  | "rebuy+"
  | "rebuy-"
  | "addon+"
  | "addon-"
  | "bonus+"
  | "bonus-";

export type RemoteClientMsg =
  | { type: "hello"; pin: string }
  | { type: "login"; loginId: string; password: string }
  | { type: "claim"; token: string; loginId: string }
  | { type: "resume"; sessionToken: string }
  | { type: "rejoin"; loginId: string }
  | { type: "punch"; token: string }
  | { type: "checkout" }
  | { type: "logout" }
  | { type: "command"; gameId: number; action: RemoteTimerAction; sec?: number; host?: string }
  | { type: "counters"; gameId: number; op: RemoteCounterOp; rebuyIndex?: number; host?: string }
  | { type: "deleteGame"; gameId: number; host?: string }
  | { type: "view"; gameId: number }
  | { type: "peer_hello"; pin: string; venueId?: string; yeoksamRole?: YeoksamRole; hostname?: string }
  | { type: "peer_command"; gameId: number; action: RemoteTimerAction; sec?: number }
  | { type: "peer_counters"; gameId: number; op: RemoteCounterOp; rebuyIndex?: number }
  | { type: "peer_deleteGame"; gameId: number }
  | {
      type: "peer_timer";
      gameId: number;
      action: TimerAction;
      minutes?: number;
      ms?: number;
      sec?: number;
    }
  | { type: "peer_assign_table"; tableSlot: number; gameId: number | null }
  | { type: "peer_assign_monitor"; monitorSlot: number; gameId: number | null }
  | { type: "peer_assign_all_monitors"; gameId: number }
  | {
      type: "peer_session_patch";
      gameId: number;
      patch: Partial<Pick<GameSession, "players" | "entries" | "rebuys" | "addon" | "bonusChip" | "leftNotice">>;
    }
  | { type: "peer_create_game"; structure: BlindStructureOption }
  | {
      type: "peer_snapshot";
      hostname: string;
      snapshot: AppSnapshot;
      timers: TableTimerState[];
      serverNow: number;
      yeoksamRole?: YeoksamRole;
      timerTheme?: ShopTimerThemePayload;
    }
  | ({ type: "peer_timer_theme" } & ShopTimerThemePayload);

export type RemoteStaffState = {
  name: string;
  loginId: string;
  checkedIn: boolean;
  canControl: boolean;
  checkedInAt: string | null;
};

export type RemotePeerSnapshot = {
  host: string;
  hostname: string;
  snapshot: AppSnapshot;
  timers: TableTimerState[];
  serverNow: number;
  yeoksamRole?: YeoksamRole;
  timerTheme?: ShopTimerThemePayload;
};

export type RemoteServerMsg =
  | { type: "hello_ok"; staffAuth: boolean; serverNow: number }
  | { type: "hello_fail"; error: string }
  | { type: "staff"; staff: RemoteStaffState; sessionToken: string }
  | {
      type: "snapshot";
      snapshot: AppSnapshot;
      timers: TableTimerState[];
      serverNow: number;
      hostname?: string;
      yeoksamRole?: YeoksamRole;
      peers?: RemotePeerSnapshot[];
      timerTheme?: ShopTimerThemePayload;
    }
  | { type: "view_ok"; gameId: number; theme: string; soundVolume: number; serverNow: number }
  | { type: "error"; error: string };

export type RemotePairingInfo = {
  pin: string;
  port: number;
  urls: string[];
  qrDataUrl: string | null;
  punchToken: string;
  expiresAt: number;
};

export function isRemoteTimerAction(v: unknown): v is RemoteTimerAction {
  return typeof v === "string" && (REMOTE_TIMER_ACTIONS as readonly string[]).includes(v);
}

export function isRemoteCounterOp(v: unknown): v is RemoteCounterOp {
  return (
    typeof v === "string" &&
    [
      "player+",
      "player-",
      "entry+",
      "entry-",
      "rebuy+",
      "rebuy-",
      "addon+",
      "addon-",
      "bonus+",
      "bonus-",
    ].includes(v)
  );
}
