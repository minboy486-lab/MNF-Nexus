import type { TableTimerState } from "@mnf/timer/types";
import { hasReachedRegClose, resolveTimerPauseKind } from "@mnf/timer/levels";
import type { AppSnapshot, GameSession } from "../../shared/types";
import { tableLetter } from "../../shared/types";

const SHARE_FOOTER = `3MP 데일리
Start : 4만 chips
1st rebuyin : 6만 chips

5MP 데일리
Start : 4만 chips
1st rebuyin : 6만 chips
2nd rebuyin : 8만 chips

    🔥핫하게 진행중입니다🔥`;

function gameNameForShare(name: string): string {
  return name.replace(/\s*게임\s*$/u, "").replace(/\s*MTT\s*$/u, "").trim();
}

function tablesForGame(snapshot: AppSnapshot, session: GameSession): number[] {
  const slots = new Set<number>();
  for (const [slot, gid] of Object.entries(snapshot.tableAssignments)) {
    if (gid === session.gameId) slots.add(Number(slot));
  }
  for (const slot of session.tableIds ?? []) slots.add(slot);
  return [...slots].filter((n) => Number.isInteger(n) && n >= 1).sort((a, b) => a - b);
}

function tableLabel(slots: number[]): string {
  const letters = slots.map((s) => tableLetter(s));
  if (letters.length === 0) return "";
  if (letters.length === 1) return `${letters[0]} 테이블`;
  return `${letters.join(",")} 테이블`;
}

function blindParen(timer: TableTimerState | undefined): string {
  if (!timer) return "—";
  const pause = resolveTimerPauseKind(timer);
  if (pause === "reg-close") return "레지마감";
  if (pause === "break") return "BREAK";
  if (hasReachedRegClose(timer)) return "레지마감";
  return `${timer.smallBlind}/${timer.bigBlind}`;
}

function isMttShare(session: GameSession, slots: number[]): boolean {
  return session.isMtt === true || slots.length >= 2;
}

function gameBlock(session: GameSession, snapshot: AppSnapshot, timers: TableTimerState[]): string {
  const slots = tablesForGame(snapshot, session);
  const mtt = isMttShare(session, slots);
  const name = gameNameForShare(session.structureName || "게임");
  const gameTitle = mtt ? "MTT게임" : `${name} 게임`;
  const tables = tableLabel(slots);
  const title = tables ? `🤩 ${tables} ${gameTitle} 🤩` : `🤩 ${gameTitle} 🤩`;
  const timer = timers.find((t) => t.tableId === session.gameId);
  const level = Math.floor(timer?.blindLevel ?? 1);
  const levelLine = `🌜Lv.${level} (${blindParen(timer)})🌛`;
  const indent = "         ";
  return `${title}\n${indent}${levelLine}`;
}

export type KakaoOrigin = {
  snapshot: AppSnapshot;
  timers: TableTimerState[];
};

export function formatKakaoGameStatusFromOrigins(origins: KakaoOrigin[]): string {
  const games = origins.flatMap((o) =>
    [...o.snapshot.sessions].map((session) => ({ session, origin: o })),
  );
  games.sort((a, b) => {
    const ta = tablesForGame(a.origin.snapshot, a.session)[0] ?? 99;
    const tb = tablesForGame(b.origin.snapshot, b.session)[0] ?? 99;
    return ta - tb || a.session.gameId - b.session.gameId;
  });
  const blocks = games.map((g) => gameBlock(g.session, g.origin.snapshot, g.origin.timers)).join("\n\n");
  const body = blocks ? `${blocks}\n\n` : "";
  return `☪️ MNF HOLDEM ☪️

 ✨ MNF HOLDEM 진행현황 ✨

${body}${SHARE_FOOTER}`;
}

export function formatKakaoGameStatus(snapshot: AppSnapshot, timers: TableTimerState[]): string {
  return formatKakaoGameStatusFromOrigins([{ snapshot, timers }]);
}

export type ShareStatusResult = "shared" | "cancelled" | "sheet";

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function androidSendIntent(text: string): string {
  return (
    "intent:#Intent;action=android.intent.action.SEND;type=text/plain;" +
    "S.android.intent.extra.SUBJECT=" +
    encodeURIComponent("MNF HOLDEM 진행현황") +
    ";S.android.intent.extra.TEXT=" +
    encodeURIComponent(text) +
    ";end"
  );
}

function canUseWebShare(text: string): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return true;
  try {
    return navigator.canShare({ text });
  } catch {
    return false;
  }
}

/** 시스템 공유창(카톡·복사 포함). 불가하면 sheet. */
export async function shareGameStatus(text: string): Promise<ShareStatusResult> {
  if (canUseWebShare(text)) {
    try {
      await navigator.share({ title: "MNF HOLDEM 진행현황", text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
    }
  }
  if (isAndroid()) {
    window.location.assign(androidSendIntent(text));
    return "shared";
  }
  return "sheet";
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* HTTP LAN 등 */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
