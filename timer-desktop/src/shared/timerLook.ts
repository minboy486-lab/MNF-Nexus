import type { TableTimerState } from "@mnf/timer/types";
import {
  normalizeControlLook,
  normalizeSavedControlThemes,
  resolveActiveControlThemeId,
  type ControlLook,
  type SavedControlTheme,
} from "./controlLook";
import {
  isUiThemeId,
  normalizeUiTheme,
  resolveControlTheme,
  resolveTimerTheme,
  withUiThemes,
  type AppConfig,
  type GameSession,
  type UiThemeId,
} from "./types";

export const TIMER_WIDGET_IDS = [
  "title",
  "level",
  "timer",
  "blinds",
  "next",
  "notice",
  "totalTime",
  "player",
  "entry",
  "rebuy",
  "totalChip",
  "avgChip",
  "nextBreak",
] as const;

export type TimerWidgetId = (typeof TIMER_WIDGET_IDS)[number];

export const TIMER_WIDGET_LABELS: Record<TimerWidgetId, string> = {
  title: "게임 이름",
  level: "LEVEL",
  timer: "타이머",
  blinds: "블라인드",
  next: "NEXT",
  notice: "왼쪽 문구",
  totalTime: "TOTAL TIME",
  player: "PLAYER",
  entry: "ENTRY",
  rebuy: "REBUY",
  totalChip: "TOTAL CHIP",
  avgChip: "AVG CHIP",
  nextBreak: "NEXT BREAK",
};

export type TimerAlign = "left" | "center" | "right";

export interface TimerWidgetLook {
  x: number;
  y: number;
  /** 원래 레이아웃에서 이동한 양 (% of stage) */
  ox?: number;
  oy?: number;
  /** 너비 % (문구 패널 등) */
  w?: number;
  fontSize: number;
  sizeSet?: boolean;
  color: string;
  colorSet?: boolean;
  /** 타이머 그라데이션 아래색 */
  color2?: string;
  labelColor?: string;
  labelColorSet?: boolean;
  labelFontSize?: number;
  pillBg?: string;
  align: TimerAlign;
  visible: boolean;
}

export interface TimerLook {
  /** true 만 적용. 없으면 예전 CSS 레이아웃 */
  overlay?: boolean;
  bg: string;
  bg2?: string | null;
  bgSet?: boolean;
  showLogo: boolean;
  widgets: Record<TimerWidgetId, TimerWidgetLook>;
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function asAlign(value: unknown, fallback: TimerAlign): TimerAlign {
  return value === "left" || value === "center" || value === "right" ? value : fallback;
}

function asColor(value: unknown, fallback: string): string {
  return isHexColor(value) ? value.trim() : fallback;
}

function widget(partial: TimerWidgetLook): TimerWidgetLook {
  return partial;
}

function layout(colors: {
  bg: string;
  bg2?: string | null;
  title: string;
  level: string;
  levelPill?: string;
  timer: string;
  timer2?: string;
  text: string;
  muted: string;
  player: string;
}): Omit<TimerLook, "showLogo"> & { showLogo: boolean } {
  const stat = (y: number, color: string, fontSize = 34): TimerWidgetLook =>
    widget({
      x: 97.5,
      y,
      fontSize,
      color,
      labelColor: colors.muted,
      labelFontSize: 16,
      align: "right",
      visible: true,
    });

  return {
    bg: colors.bg,
    bg2: colors.bg2 ?? null,
    showLogo: true,
    widgets: {
      title: widget({
        x: 50,
        y: 7.2,
        fontSize: 48,
        color: colors.title,
        align: "center",
        visible: true,
      }),
      level: widget({
        x: 50,
        y: 29,
        fontSize: 36,
        color: colors.level,
        pillBg: colors.levelPill,
        align: "center",
        visible: true,
      }),
      timer: widget({
        x: 50,
        y: 46,
        fontSize: 240,
        color: colors.timer,
        color2: colors.timer2,
        align: "center",
        visible: true,
      }),
      blinds: widget({
        x: 50,
        y: 66,
        fontSize: 52,
        color: colors.text,
        labelColor: colors.muted,
        labelFontSize: 20,
        align: "center",
        visible: true,
      }),
      next: widget({
        x: 50,
        y: 80,
        fontSize: 32,
        color: colors.text,
        labelColor: colors.muted,
        labelFontSize: 18,
        align: "center",
        visible: true,
      }),
      notice: widget({
        x: 2.2,
        y: 16,
        w: 18,
        fontSize: 22,
        color: colors.text,
        align: "left",
        visible: true,
      }),
      totalTime: stat(12, colors.text, 32),
      player: stat(26, colors.player, 38),
      entry: stat(40, colors.text),
      rebuy: stat(50, colors.text),
      totalChip: stat(64, colors.text),
      avgChip: stat(74, colors.text),
      nextBreak: stat(88, colors.text),
    },
  };
}

export function defaultTimerLook(theme: UiThemeId): TimerLook {
  if (theme === "mnf-original") {
    return layout({
      bg: "#faf9fc",
      bg2: "#fff5f8",
      title: "#1c1230",
      level: "#ffffff",
      levelPill: "#8b46f0",
      timer: "#8b46f0",
      timer2: "#e83d6e",
      text: "#1c1230",
      muted: "#6a5a82",
      player: "#8b46f0",
    });
  }
  if (theme === "cherry-blossom") {
    return layout({
      bg: "#fff6f8",
      bg2: "#fff5ee",
      title: "#4a3d58",
      level: "#ffffff",
      levelPill: "#c44569",
      timer: "#c44569",
      timer2: "#e07050",
      text: "#4a3d58",
      muted: "#8a7080",
      player: "#c44569",
    });
  }
  return layout({
    bg: "#05070c",
    bg2: null,
    title: "#e8e6ef",
    level: "#ffb6c9",
    timer: "#ffb6c9",
    text: "#e8e6ef",
    muted: "#9a889a",
    player: "#ffb6c9",
  });
}

function normalizeWidget(raw: unknown, fallback: TimerWidgetLook): TimerWidgetLook {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fontSize = clamp(typeof o.fontSize === "number" ? o.fontSize : fallback.fontSize, 8, 420);
  const labelFontSize =
    o.labelFontSize == null
      ? fallback.labelFontSize
      : clamp(typeof o.labelFontSize === "number" ? o.labelFontSize : fallback.labelFontSize ?? 14, 8, 200);
  const w =
    o.w == null ? fallback.w : clamp(typeof o.w === "number" ? o.w : fallback.w ?? 20, 4, 100);
  return {
    x: clamp(typeof o.x === "number" ? o.x : fallback.x, 0, 100),
    y: clamp(typeof o.y === "number" ? o.y : fallback.y, 0, 100),
    w,
    fontSize,
    color: asColor(o.color, fallback.color),
    color2: o.color2 == null ? fallback.color2 : isHexColor(o.color2) ? o.color2.trim() : fallback.color2,
    labelColor: o.labelColor == null ? fallback.labelColor : asColor(o.labelColor, fallback.labelColor ?? fallback.color),
    labelFontSize,
    pillBg: o.pillBg == null ? fallback.pillBg : o.pillBg === "" ? undefined : asColor(o.pillBg, fallback.pillBg ?? "#000000"),
    align: asAlign(o.align, fallback.align),
    visible: o.visible == null ? fallback.visible : o.visible !== false,
    ox: clamp(typeof o.ox === "number" ? o.ox : fallback.ox ?? 0, -100, 100),
    oy: clamp(typeof o.oy === "number" ? o.oy : fallback.oy ?? 0, -100, 100),
    sizeSet: o.sizeSet === true || fallback.sizeSet === true,
    colorSet: o.colorSet === true || fallback.colorSet === true,
    labelColorSet: o.labelColorSet === true || fallback.labelColorSet === true,
  };
}

/** 없거나 예전 자유배치 값은 null → 기존 CSS 타이머 레이아웃 */
export function normalizeTimerLook(raw: unknown, theme: UiThemeId = "black-pink"): TimerLook | null {
  if (raw == null || raw === false) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.enabled === false) return null;
  if (o.overlay !== true) return null;
  const base = overlayFromTheme(theme);
  const widgetsRaw = o.widgets && typeof o.widgets === "object" ? (o.widgets as Record<string, unknown>) : {};
  const widgets = { ...base.widgets };
  for (const id of TIMER_WIDGET_IDS) {
    widgets[id] = normalizeWidget(widgetsRaw[id], base.widgets[id]);
  }
  let bg2 = base.bg2 ?? null;
  if (o.bg2 === null || o.bg2 === "") bg2 = null;
  else if (isHexColor(o.bg2)) bg2 = o.bg2.trim();

  return {
    overlay: true,
    bg: asColor(o.bg, base.bg),
    bg2,
    bgSet: o.bgSet === true,
    showLogo: o.showLogo == null ? base.showLogo : o.showLogo !== false,
    widgets,
  };
}

/** 기존 레이아웃 위에 덮을 시작값 (위치·크기는 CSS 그대로) */
export function overlayFromTheme(theme: UiThemeId): TimerLook {
  const base = defaultTimerLook(theme);
  const widgets = { ...base.widgets };
  for (const id of TIMER_WIDGET_IDS) {
    widgets[id] = {
      ...base.widgets[id],
      ox: 0,
      oy: 0,
      sizeSet: false,
      colorSet: false,
      labelColorSet: false,
    };
  }
  return {
    ...base,
    overlay: true,
    bgSet: false,
    widgets,
  };
}

export function lookFontSize(px: number): string {
  return `calc(${px} * 100cqh / 1080)`;
}

export function lookBackground(look: TimerLook): string {
  if (look.bg2) return `linear-gradient(145deg, ${look.bg} 0%, ${look.bg2} 100%)`;
  return look.bg;
}

export function patchTimerWidget(
  look: TimerLook,
  id: TimerWidgetId,
  patch: Partial<TimerWidgetLook>,
): TimerLook {
  return {
    ...look,
    widgets: {
      ...look.widgets,
      [id]: { ...look.widgets[id], ...patch },
    },
  };
}

export const MAX_SAVED_TIMER_THEMES = 12;
export const SAVED_TIMER_THEME_NAME_MAX = 24;

export interface SavedTimerTheme {
  id: string;
  name: string;
  baseTheme: UiThemeId;
  look: TimerLook;
}

export function newSavedTimerThemeId(): string {
  return `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeThemeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, SAVED_TIMER_THEME_NAME_MAX);
}

export function normalizeSavedTimerTheme(raw: unknown, fallbackTheme: UiThemeId): SavedTimerTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.startsWith("saved-") ? o.id : null;
  const name = normalizeThemeName(o.name);
  if (!id || !name) return null;
  const baseTheme = isUiThemeId(o.baseTheme) ? o.baseTheme : fallbackTheme;
  const look = normalizeTimerLook(o.look, baseTheme);
  if (!look) return null;
  return { id, name, baseTheme, look };
}

export function normalizeSavedTimerThemes(raw: unknown, fallbackTheme: UiThemeId): SavedTimerTheme[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedTimerTheme[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const theme = normalizeSavedTimerTheme(item, fallbackTheme);
    if (!theme || seen.has(theme.id)) continue;
    seen.add(theme.id);
    out.push(theme);
    if (out.length >= MAX_SAVED_TIMER_THEMES) break;
  }
  return out;
}

export function resolveActiveTimerThemeId(
  config:
    | Pick<AppConfig, "timerTheme" | "theme" | "savedTimerThemes" | "activeTimerThemeId" | "timerLook">
    | null
    | undefined,
): string {
  if (!config) return "black-pink";
  const timerTheme = resolveTimerTheme(config);
  const saved = normalizeSavedTimerThemes(config.savedTimerThemes, timerTheme);
  const id = typeof config.activeTimerThemeId === "string" ? config.activeTimerThemeId : "";
  if (saved.some((s) => s.id === id)) return id;
  if (isUiThemeId(id)) return id;
  return timerTheme;
}

export function savedThemeSwatch(theme: SavedTimerTheme): string {
  const look = theme.look;
  if (look.bgSet) {
    return look.bg2 ? `linear-gradient(135deg, ${look.bg}, ${look.bg2})` : look.bg;
  }
  const tw = look.widgets.timer;
  if (tw.colorSet) {
    return tw.color2 ? `linear-gradient(135deg, ${tw.color}, ${tw.color2})` : tw.color;
  }
  return "";
}

export function applyTimerThemeChoice(config: AppConfig, id: string): AppConfig {
  const currentTheme = resolveTimerTheme(config);
  const saved = normalizeSavedTimerThemes(config.savedTimerThemes, currentTheme);
  const hit = saved.find((s) => s.id === id);
  if (hit) {
    return {
      ...withUiThemes(config, { timerTheme: hit.baseTheme }),
      savedTimerThemes: saved,
      activeTimerThemeId: hit.id,
      timerLook: hit.look,
    };
  }
  const theme = normalizeUiTheme(id);
  return {
    ...withUiThemes(config, { timerTheme: theme }),
    savedTimerThemes: saved,
    activeTimerThemeId: theme,
    timerLook: null,
  };
}

export function upsertSavedTimerTheme(
  config: AppConfig,
  opts: { name: string; look: TimerLook; id?: string; baseTheme?: UiThemeId },
): { ok: true; config: AppConfig; saved: SavedTimerTheme } | { ok: false; error: string } {
  const baseTheme = opts.baseTheme ?? resolveTimerTheme(config);
  const look = normalizeTimerLook({ ...opts.look, overlay: true }, baseTheme);
  if (!look) return { ok: false, error: "디자인을 저장할 수 없습니다." };
  const name = normalizeThemeName(opts.name);
  if (!name) return { ok: false, error: "테마 이름을 입력하세요." };
  let list = normalizeSavedTimerThemes(config.savedTimerThemes, baseTheme);
  const byId = opts.id ? list.find((s) => s.id === opts.id) : undefined;
  const byName = !opts.id ? list.find((s) => s.name === name) : undefined;
  const existing = byId ?? byName;
  let saved: SavedTimerTheme;
  if (existing) {
    saved = { ...existing, name, baseTheme, look };
    list = list.map((s) => (s.id === existing.id ? saved : s));
  } else {
    if (list.length >= MAX_SAVED_TIMER_THEMES) {
      return { ok: false, error: `저장한 테마는 ${MAX_SAVED_TIMER_THEMES}개까지입니다.` };
    }
    saved = { id: newSavedTimerThemeId(), name, baseTheme, look };
    list = [...list, saved];
  }
  return {
    ok: true,
    saved,
    config: {
      ...withUiThemes(config, { timerTheme: baseTheme }),
      savedTimerThemes: list,
      activeTimerThemeId: saved.id,
      timerLook: look,
    },
  };
}

export function deleteSavedTimerTheme(config: AppConfig, id: string): AppConfig {
  const base = resolveTimerTheme(config);
  const list = normalizeSavedTimerThemes(config.savedTimerThemes, base).filter((s) => s.id !== id);
  const next = { ...config, savedTimerThemes: list };
  if (config.activeTimerThemeId === id) return applyTimerThemeChoice(next, base);
  return next;
}

export interface ShopTimerThemePayload {
  timerTheme: UiThemeId;
  activeTimerThemeId: string;
  timerLook: TimerLook | null;
  savedTimerThemes: SavedTimerTheme[];
  controlTheme: UiThemeId;
  activeControlThemeId: string;
  controlLook: ControlLook | null;
  savedControlThemes: SavedControlTheme[];
}

export function shopTimerThemeFromConfig(config: AppConfig): ShopTimerThemePayload {
  const timerTheme = resolveTimerTheme(config);
  const savedTimerThemes = normalizeSavedTimerThemes(config.savedTimerThemes, timerTheme);
  const timerLook = normalizeTimerLook(config.timerLook, timerTheme);
  const controlTheme = resolveControlTheme(config);
  const savedControlThemes = normalizeSavedControlThemes(config.savedControlThemes, controlTheme);
  const controlLook = normalizeControlLook(config.controlLook, controlTheme);
  return {
    timerTheme,
    activeTimerThemeId: resolveActiveTimerThemeId({
      ...config,
      timerTheme,
      savedTimerThemes,
      timerLook,
    }),
    timerLook,
    savedTimerThemes,
    controlTheme,
    activeControlThemeId: resolveActiveControlThemeId({
      ...config,
      controlTheme,
      savedControlThemes,
      controlLook,
    }),
    controlLook,
    savedControlThemes,
  };
}

export function normalizeShopTimerTheme(raw: unknown): ShopTimerThemePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hasTimer =
    o.timerTheme != null ||
    o.activeTimerThemeId != null ||
    o.timerLook != null ||
    o.savedTimerThemes != null;
  const hasControl =
    o.controlTheme != null ||
    o.activeControlThemeId != null ||
    o.controlLook != null ||
    o.savedControlThemes != null;
  if (!hasTimer && !hasControl) return null;

  const timerTheme = normalizeUiTheme(o.timerTheme);
  const savedTimerThemes = normalizeSavedTimerThemes(o.savedTimerThemes, timerTheme);
  const timerLook = normalizeTimerLook(o.timerLook, timerTheme);
  const controlTheme = normalizeUiTheme(o.controlTheme ?? o.timerTheme);
  const savedControlThemes = normalizeSavedControlThemes(o.savedControlThemes, controlTheme);
  const controlLook = normalizeControlLook(o.controlLook, controlTheme);

  return {
    timerTheme,
    activeTimerThemeId: resolveActiveTimerThemeId({
      timerTheme,
      savedTimerThemes,
      timerLook,
      activeTimerThemeId: typeof o.activeTimerThemeId === "string" ? o.activeTimerThemeId : undefined,
    }),
    timerLook,
    savedTimerThemes,
    controlTheme,
    activeControlThemeId: resolveActiveControlThemeId({
      controlTheme,
      savedControlThemes,
      controlLook,
      activeControlThemeId: typeof o.activeControlThemeId === "string" ? o.activeControlThemeId : undefined,
    }),
    controlLook,
    savedControlThemes,
  };
}

export function shopTimerThemeEqual(a: ShopTimerThemePayload, b: ShopTimerThemePayload): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function withShopTimerTheme(config: AppConfig, pack: ShopTimerThemePayload): AppConfig {
  return {
    ...withUiThemes(config, { timerTheme: pack.timerTheme, controlTheme: pack.controlTheme }),
    timerLook: pack.timerLook,
    savedTimerThemes: pack.savedTimerThemes,
    activeTimerThemeId: pack.activeTimerThemeId,
    controlLook: pack.controlLook,
    savedControlThemes: pack.savedControlThemes,
    activeControlThemeId: pack.activeControlThemeId,
  };
}

export function sampleLookSession(): GameSession {
  return {
    gameId: 1,
    structureId: "sample",
    structureName: "MNF HOLDEM",
    tableIds: [1],
    isChampionship: false,
    entryChip: 50000,
    rebuyChips: [50000],
    rebuyCount: 1,
    hasAddon: false,
    addonChip: 0,
    hasBonusChip: false,
    bonusChipAmount: 0,
    startedAt: Date.now() - 45 * 60 * 1000,
    totalElapsedMs: 45 * 60 * 1000,
    totalRunningAt: Date.now(),
    players: 12,
    entries: 18,
    rebuys: [3],
    addon: 0,
    bonusChip: 0,
    leftNotice: { html: "<p>등록 마감 21:00</p><p>자리 이동은 데스크</p>" },
    participants: [],
    dailyGameNo: 1,
  };
}

export function sampleLookTimer(): TableTimerState {
  return {
    tableId: 1,
    status: "running",
    blindLevel: 3,
    endsAt: Date.now() + 4 * 60 * 1000 + 44 * 1000,
    remainingMs: 4 * 60 * 1000 + 44 * 1000,
    smallBlind: 200,
    bigBlind: 400,
    ante: 400,
    blindStructureId: "sample",
    blindStructureName: "MNF HOLDEM",
    levels: [
      { level: 3, small: 200, big: 400, ante: 400, durationSec: 900 },
      { level: 4, small: 300, big: 600, ante: 600, durationSec: 900 },
      { level: 8, small: 0, big: 0, ante: 0, durationSec: 600, pauseKind: "break" },
    ],
  };
}
