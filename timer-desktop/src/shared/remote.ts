import type { AppSnapshot } from "./types";
import type { TableTimerState } from "@mnf/timer/types";

export const REMOTE_PORT = 17890;
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
  | { type: "punch"; token: string }
  | { type: "checkout" }
  | { type: "logout" }
  | { type: "command"; gameId: number; action: RemoteTimerAction; sec?: number }
  | { type: "counters"; gameId: number; op: RemoteCounterOp; rebuyIndex?: number }
  | { type: "deleteGame"; gameId: number };

export type RemoteStaffState = {
  name: string;
  loginId: string;
  checkedIn: boolean;
  canControl: boolean;
  checkedInAt: string | null;
};

export type RemoteServerMsg =
  | { type: "hello_ok"; staffAuth: boolean; serverNow: number }
  | { type: "hello_fail"; error: string }
  | { type: "staff"; staff: RemoteStaffState; sessionToken: string }
  | { type: "snapshot"; snapshot: AppSnapshot; timers: TableTimerState[]; serverNow: number }
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
