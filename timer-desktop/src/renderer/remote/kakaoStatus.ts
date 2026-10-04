import type { TableTimerState } from "@mnf/timer/types";
import { hasReachedRegClose, resolveTimerPauseKind } from "@mnf/timer/levels";
import { kakaoShareBrandName } from "@mnf/venue";
import type { AppSnapshot, GameSession } from "../../shared/types";
import { floorTableLetter } from "../../shared/floorPlan";

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

function tableLabel(venueId: string | null | undefined, slots: number[]): string {
  const letters = slots.map((s) => floorTableLetter(venueId, s));
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
  const ante = Math.max(0, Math.floor(timer.ante ?? 0));
  const base = `${timer.smallBlind}/${timer.bigBlind}`;
  return ante > 0 ? `${base}/${ante}` : base;
}

function isMttShare(session: GameSession, slots: number[]): boolean {
  return session.isMtt === true || slots.length >= 2;
}

function gameBlock(
  session: GameSession,
  snapshot: AppSnapshot,
  timers: TableTimerState[],
  venueId?: string | null,
): string {
  const slots = tablesForGame(snapshot, session);
  // 대회 프리셋은 테이블 수와 관계없이 구조 이름 유지 (MTT게임 표기 안 함)
  const championship = session.isChampionship === true;
  const mtt = !championship && isMttShare(session, slots);
  const name = gameNameForShare(session.structureName || "게임");
  const gameTitle = mtt ? "MTT게임" : `${name} 게임`;
  const tables = tableLabel(venueId, slots);
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
  venueId?: string | null;
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
  const brand = kakaoShareBrandName(origins.find((o) => o.venueId)?.venueId ?? origins[0]?.venueId);
  const blocks = games.map((g) => gameBlock(g.session, g.origin.snapshot, g.origin.timers, g.origin.venueId)).join("\n\n");
  const body = blocks ? `${blocks}\n\n` : "";
  return `☪️ ${brand} ☪️

 ✨ ${brand} 진행현황 ✨

${body}${SHARE_FOOTER}`;
}

export function formatKakaoGameStatus(
  snapshot: AppSnapshot,
  timers: TableTimerState[],
  venueId?: string | null,
): string {
  return formatKakaoGameStatusFromOrigins([{ snapshot, timers, venueId }]);
}

/** 화면복사 등 단일 게임용 카톡 문구 */
export function formatKakaoGameStatusForGame(
  session: GameSession,
  snapshot: AppSnapshot,
  timers: TableTimerState[],
  venueId?: string | null,
): string {
  const brand = kakaoShareBrandName(venueId);
  const block = gameBlock(session, snapshot, timers, venueId);
  return `☪️ ${brand} ☪️

 ✨ ${brand} 진행현황 ✨

${block}

${SHARE_FOOTER}`;
}

export type ShareStatusResult = "shared" | "cancelled" | "sheet";

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function androidSendIntent(text: string): string {
  return (
    "intent:#Intent;action=android.intent.action.SEND;type=text/plain;" +
    "S.android.intent.extra.TEXT=" +
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
      await navigator.share({ text });
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

async function blobToPng(image: Blob): Promise<Blob> {
  if (image.type === "image/png") return image;
  const url = URL.createObjectURL(image);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unsupported");
    ctx.drawImage(img, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("png encode failed");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 화면 이미지를 클립보드에 복사 (저장/다운로드 없음). */
export async function copyImageToClipboard(image: Blob): Promise<boolean> {
  const png = await blobToPng(image).catch(() => image);

  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          [png.type || "image/png"]: png,
        }),
      ]);
      return true;
    }
  } catch {
    /* HTTP LAN / 권한 등 → fallback */
  }

  // contenteditable + 이미지 선택 복사 (일부 모바일 브라우저)
  try {
    const url = URL.createObjectURL(png);
    const wrap = document.createElement("div");
    wrap.contentEditable = "true";
    wrap.style.position = "fixed";
    wrap.style.left = "-9999px";
    wrap.style.opacity = "0";
    const img = document.createElement("img");
    img.src = url;
    wrap.appendChild(img);
    document.body.appendChild(wrap);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img"));
      if (img.complete) resolve();
    });
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(wrap);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const ok = document.execCommand("copy");
    selection?.removeAllRanges();
    document.body.removeChild(wrap);
    URL.revokeObjectURL(url);
    if (ok) return true;
  } catch {
    /* ignore */
  }
  return false;
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
