import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import type { StaffAuthOk } from "../supabase/staffAuth";

export type StoredRemoteSession = {
  token: string;
  staff: StaffAuthOk;
  canControl: boolean;
};

export type RemoteAuthState = {
  pin: string;
  sessions: StoredRemoteSession[];
};

const MAX_SESSIONS = 40;

function newPin(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

export function getRemoteAuthPath(): string {
  return join(app.getPath("userData"), "remote-auth.json");
}

function isPin(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}$/.test(v);
}

function isStoredSession(v: unknown): v is StoredRemoteSession {
  if (!v || typeof v !== "object") return false;
  const o = v as StoredRemoteSession;
  const staff = o.staff;
  return (
    typeof o.token === "string" &&
    o.token.length > 8 &&
    !!staff &&
    typeof staff === "object" &&
    typeof staff.staffId === "string" &&
    typeof staff.loginId === "string"
  );
}

export function loadRemoteAuth(): RemoteAuthState {
  const path = getRemoteAuthPath();
  try {
    if (existsSync(path)) {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<RemoteAuthState>;
      const pin = isPin(parsed.pin) ? parsed.pin : newPin();
      const sessions = Array.isArray(parsed.sessions)
        ? parsed.sessions.filter(isStoredSession).slice(-MAX_SESSIONS)
        : [];
      const state = { pin, sessions };
      if (!isPin(parsed.pin)) saveRemoteAuth(state);
      return state;
    }
  } catch {
    /* fall through */
  }
  const state = { pin: newPin(), sessions: [] as StoredRemoteSession[] };
  saveRemoteAuth(state);
  return state;
}

export function saveRemoteAuth(state: RemoteAuthState): void {
  const path = getRemoteAuthPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ pin: state.pin, sessions: state.sessions.slice(-MAX_SESSIONS) }, null, 2),
    "utf8",
  );
}
