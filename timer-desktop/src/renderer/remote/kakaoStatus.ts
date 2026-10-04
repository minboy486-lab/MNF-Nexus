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

function isMobileUa(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** 캡처 JPEG 등을 클립보드용 PNG로 미리 변환 (버튼 클릭 전에 끝낸다). */
export async function prepareClipboardPng(image: Blob): Promise<Blob> {
  if (image.type === "image/png" && image.size > 0) {
    return image.slice(0, image.size, "image/png");
  }
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
    if (canvas.width < 1 || canvas.height < 1) throw new Error("empty image");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unsupported");
    ctx.drawImage(img, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png || png.size < 32) throw new Error("png encode failed");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function asShareFile(image: Blob, filename: string): File {
  const type = image.type && image.type.startsWith("image/") ? image.type : "image/jpeg";
  const name =
    filename ||
    (type === "image/png" ? "blind-screen.png" : "blind-screen.jpg");
  return new File([image], name, { type });
}

/** 시스템 공유창으로 이미지 전송 (카톡 선택). 폰에서는 클립보드보다 이게 본체. */
export async function shareImageFile(
  image: Blob,
  filename = "blind-screen.jpg",
): Promise<"shared" | "cancelled" | "unsupported"> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return "unsupported";
  }
  if (!image || image.size < 32) return "unsupported";
  const file = asShareFile(image, filename);
  try {
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
      return "unsupported";
    }
  } catch {
    return "unsupported";
  }
  try {
    await navigator.share({ files: [file], title: "블라인드 화면" });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    if (err instanceof Error && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

/**
 * 화면 이미지를 클립보드에 복사.
 * ClipboardItem만 사용한다. execCommand 폴백은 폰에서 공백만 복사되는 거짓 성공을 낸다.
 */
export async function copyImageToClipboard(image: Blob, _previewImg?: HTMLImageElement | null): Promise<boolean> {
  if (!image || image.size < 32) return false;
  if (!window.isSecureContext) return false;
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;

  // JPEG를 image/png로 속이지 않는다 — 실제 PNG만 png 타입으로 쓴다
  let png: Blob;
  try {
    png = image.type === "image/png" ? image : await prepareClipboardPng(image);
  } catch {
    return false;
  }
  if (png.size < 32) return false;

  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": Promise.resolve(png) })]);
      return true;
    } catch {
      return false;
    }
  }
}

export type ImageHandoffResult = "shared" | "copied" | "cancelled" | "manual";

/**
 * 카톡/복사 버튼용.
 * 폰은 공유창이 본체. 클립보드는 ClipboardItem 성공일 때만 "copied".
 * (execCommand 이미지 복사는 공백 한 칸만 들어가는 경우가 많아 쓰지 않음)
 */
export async function handoffImage(
  image: Blob,
  opts?: { preferShare?: boolean; filename?: string; previewImg?: HTMLImageElement | null },
): Promise<ImageHandoffResult> {
  const filename =
    opts?.filename ?? (image.type === "image/png" ? "blind-screen.png" : "blind-screen.jpg");
  const preferShare = opts?.preferShare !== false || isMobileUa();

  if (preferShare) {
    const shared = await shareImageFile(image, filename);
    if (shared === "shared") return "shared";
    if (shared === "cancelled") return "cancelled";
  }

  if (await copyImageToClipboard(image, opts?.previewImg ?? null)) return "copied";

  if (!preferShare) {
    const shared = await shareImageFile(image, filename);
    if (shared === "shared") return "shared";
    if (shared === "cancelled") return "cancelled";
  }

  return "manual";
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
