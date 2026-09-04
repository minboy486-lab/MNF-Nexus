import {
  isUiThemeId,
  normalizeUiTheme,
  resolveControlTheme,
  tableLetter,
  withUiThemes,
  type AppConfig,
  type UiThemeId,
} from "./types";
import { isYeoksamFloor, monitorLabel } from "./floorPlan";

export const CONTROL_WIDGET_IDS = [
  "header",
  "storeMgmt",
  "floor",
  "games",
  "table1",
  "table2",
  "table3",
  "table4",
  "table5",
  "monitor1",
  "monitor2",
  "monitor3",
  "monitor4",
  "monitor5",
  "monitor6",
  "back",
  "gameHead",
  "preview",
  "timeAdj",
  "play",
  "blinds",
  "notice",
  "reset",
  "endGame",
  "chips",
  "totalEntry",
  "player",
  "entry",
  "rebuy",
  "addon",
  "bonus",
] as const;

export type ControlWidgetId = (typeof CONTROL_WIDGET_IDS)[number];

export const CONTROL_WIDGET_LABELS: Record<ControlWidgetId, string> = {
  header: "상단 바",
  storeMgmt: "매장 관리",
  floor: "플로어",
  games: "게임 목록",
  table1: "테이블 A",
  table2: "테이블 B",
  table3: "테이블 C",
  table4: "테이블 D",
  table5: "테이블 E",
  monitor1: "모니터 1",
  monitor2: "모니터 2",
  monitor3: "모니터 3",
  monitor4: "모니터 4",
  monitor5: "모니터 5",
  monitor6: "모니터 6",
  back: "뒤로",
  gameHead: "게임 제목",
  preview: "타이머 미리보기",
  timeAdj: "시간 조정",
  play: "시작/일시정지",
  blinds: "블라인드",
  notice: "좌측 문구",
  reset: "리셋",
  endGame: "게임 종료",
  chips: "칩 요약",
  totalEntry: "총 엔트리",
  player: "플레이어",
  entry: "엔트리",
  rebuy: "리바인",
  addon: "애드온",
  bonus: "보너스칩",
};

export function isFloorSlotWidget(id: ControlWidgetId): boolean {
  return id.startsWith("table") || id.startsWith("monitor");
}

export function storeSlotWidgets(venueId: string | null | undefined): {
  tables: ControlWidgetId[];
  monitors: ControlWidgetId[];
} {
  if (isYeoksamFloor(venueId)) {
    return {
      tables: ["table2", "table3", "table4"],
      monitors: ["monitor4", "monitor2", "monitor1", "monitor3"],
    };
  }
  return {
    tables: ["table1", "table2", "table3", "table4", "table5"],
    monitors: ["monitor1", "monitor2", "monitor3", "monitor4", "monitor5"],
  };
}

export function storeSlotLabel(id: ControlWidgetId, venueId: string | null | undefined): string {
  if (id.startsWith("table")) {
    const slot = Number(id.slice(5));
    return `테이블 ${tableLetter(slot)}`;
  }
  if (id.startsWith("monitor")) {
    const slot = Number(id.slice(7));
    return monitorLabel(venueId, slot);
  }
  return CONTROL_WIDGET_LABELS[id];
}

export const CONTROL_FLOOR_WIDGETS: ControlWidgetId[] = ["header", "storeMgmt", "floor", "games"];
export const CONTROL_GAME_WIDGETS: ControlWidgetId[] = [
  "back",
  "gameHead",
  "preview",
  "timeAdj",
  "play",
  "blinds",
  "notice",
  "reset",
  "endGame",
  "chips",
  "totalEntry",
  "player",
  "entry",
  "rebuy",
  "addon",
  "bonus",
];

export interface ControlWidgetLook {
  ox?: number;
  oy?: number;
  visible: boolean;
  color: string;
  colorSet?: boolean;
  colorOn?: string;
  colorOnSet?: boolean;
  fontSize: number;
  sizeSet?: boolean;
  scale?: number;
  scaleSet?: boolean;
  rot?: number;
}

export interface ControlLook {
  overlay?: boolean;
  bg: string;
  bg2?: string | null;
  bgSet?: boolean;
  widgets: Record<ControlWidgetId, ControlWidgetLook>;
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function asColor(value: unknown, fallback: string): string {
  return isHexColor(value) ? value.trim() : fallback;
}

const THEME_PAINT: Record<
  UiThemeId,
  { bg: string; bg2: string | null; text: string; accent: string; accent2: string }
> = {
  "black-pink": { bg: "#05070c", bg2: null, text: "#e8e6ef", accent: "#ffb6c9", accent2: "#d7baff" },
  "mnf-original": { bg: "#faf9fc", bg2: "#fff5f8", text: "#1c1230", accent: "#8b46f0", accent2: "#e83d6e" },
  "cherry-blossom": { bg: "#fff6f8", bg2: "#fff5ee", text: "#4a3d58", accent: "#c44569", accent2: "#e07050" },
};

function defaultWidget(theme: UiThemeId, id: ControlWidgetId): ControlWidgetLook {
  const paint = THEME_PAINT[theme];
  return {
    ox: 0,
    oy: 0,
    visible: true,
    color: paint.text,
    colorSet: false,
    colorOn: id.startsWith("monitor") ? paint.accent2 : paint.accent,
    colorOnSet: false,
    fontSize: 16,
    sizeSet: false,
    scale: 1,
    scaleSet: false,
    rot: 0,
  };
}

export function overlayFromControlTheme(theme: UiThemeId): ControlLook {
  const paint = THEME_PAINT[theme];
  const widgets = {} as Record<ControlWidgetId, ControlWidgetLook>;
  for (const id of CONTROL_WIDGET_IDS) {
    widgets[id] = defaultWidget(theme, id);
  }
  return {
    overlay: true,
    bg: paint.bg,
    bg2: paint.bg2,
    bgSet: false,
    widgets,
  };
}

function parseWidget(raw: unknown, fallback: ControlWidgetLook): ControlWidgetLook {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    ox: typeof o.ox === "number" ? clamp(o.ox, -80, 80) : fallback.ox,
    oy: typeof o.oy === "number" ? clamp(o.oy, -80, 80) : fallback.oy,
    visible: o.visible !== false,
    color: asColor(o.color, fallback.color),
    colorSet: o.colorSet === true,
    colorOn: asColor(o.colorOn, fallback.colorOn ?? fallback.color),
    colorOnSet: o.colorOnSet === true,
    fontSize:
      typeof o.fontSize === "number" && Number.isFinite(o.fontSize)
        ? clamp(Math.round(o.fontSize), 8, 80)
        : fallback.fontSize,
    sizeSet: o.sizeSet === true,
    scale:
      typeof o.scale === "number" && Number.isFinite(o.scale) ? clamp(o.scale, 0.4, 2.5) : fallback.scale,
    scaleSet: o.scaleSet === true,
    rot: typeof o.rot === "number" && Number.isFinite(o.rot) ? clamp(Math.round(o.rot), -180, 180) : fallback.rot,
  };
}

export function normalizeControlLook(raw: unknown, theme: UiThemeId = "black-pink"): ControlLook | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.overlay !== true) return null;
  const base = overlayFromControlTheme(theme);
  const widgetsRaw = o.widgets && typeof o.widgets === "object" ? (o.widgets as Record<string, unknown>) : {};
  const widgets = {} as Record<ControlWidgetId, ControlWidgetLook>;
  for (const id of CONTROL_WIDGET_IDS) {
    widgets[id] = parseWidget(widgetsRaw[id], base.widgets[id]);
  }
  return {
    overlay: true,
    bg: asColor(o.bg, base.bg),
    bg2: o.bg2 == null ? base.bg2 : asColor(o.bg2, base.bg2 ?? base.bg),
    bgSet: o.bgSet === true,
    widgets,
  };
}

export function patchControlWidget(
  look: ControlLook,
  id: ControlWidgetId,
  patch: Partial<ControlWidgetLook>,
): ControlLook {
  return {
    ...look,
    widgets: {
      ...look.widgets,
      [id]: { ...look.widgets[id], ...patch },
    },
  };
}

export const MAX_SAVED_CONTROL_THEMES = 12;
export const SAVED_CONTROL_THEME_NAME_MAX = 24;

export interface SavedControlTheme {
  id: string;
  name: string;
  baseTheme: UiThemeId;
  look: ControlLook;
}

export function newSavedControlThemeId(): string {
  return `csaved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeControlThemeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, SAVED_CONTROL_THEME_NAME_MAX);
}

export function normalizeSavedControlTheme(raw: unknown, fallbackTheme: UiThemeId): SavedControlTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.startsWith("csaved-") ? o.id : null;
  const name = normalizeControlThemeName(o.name);
  if (!id || !name) return null;
  const baseTheme = isUiThemeId(o.baseTheme) ? o.baseTheme : fallbackTheme;
  const look = normalizeControlLook(o.look, baseTheme);
  if (!look) return null;
  return { id, name, baseTheme, look };
}

export function normalizeSavedControlThemes(raw: unknown, fallbackTheme: UiThemeId): SavedControlTheme[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedControlTheme[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const theme = normalizeSavedControlTheme(item, fallbackTheme);
    if (!theme || seen.has(theme.id)) continue;
    seen.add(theme.id);
    out.push(theme);
    if (out.length >= MAX_SAVED_CONTROL_THEMES) break;
  }
  return out;
}

/** id 기준 병합. incoming이 같은 id면 덮어씀. incoming이 비면 local 유지. */
export function mergeSavedControlThemes(
  local: unknown,
  incoming: unknown,
  fallbackTheme: UiThemeId,
): SavedControlTheme[] {
  const a = normalizeSavedControlThemes(local, fallbackTheme);
  const b = normalizeSavedControlThemes(incoming, fallbackTheme);
  if (b.length === 0) return a;
  if (a.length === 0) return b;
  const byId = new Map<string, SavedControlTheme>();
  for (const t of a) byId.set(t.id, t);
  for (const t of b) byId.set(t.id, t);
  return Array.from(byId.values()).slice(0, MAX_SAVED_CONTROL_THEMES);
}

export function resolveActiveControlThemeId(
  config:
    | Pick<AppConfig, "controlTheme" | "theme" | "savedControlThemes" | "activeControlThemeId" | "controlLook">
    | null
    | undefined,
): string {
  if (!config) return "black-pink";
  const controlTheme = resolveControlTheme(config);
  const saved = normalizeSavedControlThemes(config.savedControlThemes, controlTheme);
  const id = typeof config.activeControlThemeId === "string" ? config.activeControlThemeId : "";
  if (saved.some((s) => s.id === id)) return id;
  if (isUiThemeId(id)) return id;
  return controlTheme;
}

export function savedControlThemeSwatch(theme: SavedControlTheme): string {
  const look = theme.look;
  if (look.bgSet) {
    return look.bg2 ? `linear-gradient(135deg, ${look.bg}, ${look.bg2})` : look.bg;
  }
  return "";
}

export function applyControlThemeChoice(config: AppConfig, id: string): AppConfig {
  const currentTheme = resolveControlTheme(config);
  const saved = normalizeSavedControlThemes(config.savedControlThemes, currentTheme);
  const hit = saved.find((s) => s.id === id);
  if (hit) {
    return {
      ...withUiThemes(config, { controlTheme: hit.baseTheme }),
      savedControlThemes: saved,
      activeControlThemeId: hit.id,
      controlLook: hit.look,
    };
  }
  const theme = normalizeUiTheme(id);
  return {
    ...withUiThemes(config, { controlTheme: theme }),
    savedControlThemes: saved,
    activeControlThemeId: theme,
    controlLook: null,
  };
}

export function upsertSavedControlTheme(
  config: AppConfig,
  opts: { name: string; look: ControlLook; id?: string; baseTheme?: UiThemeId },
): { ok: true; config: AppConfig; saved: SavedControlTheme } | { ok: false; error: string } {
  const baseTheme = opts.baseTheme ?? resolveControlTheme(config);
  const look = normalizeControlLook({ ...opts.look, overlay: true }, baseTheme);
  if (!look) return { ok: false, error: "디자인을 저장할 수 없습니다." };
  const name = normalizeControlThemeName(opts.name);
  if (!name) return { ok: false, error: "테마 이름을 입력하세요." };
  let list = normalizeSavedControlThemes(config.savedControlThemes, baseTheme);
  const byId = opts.id ? list.find((s) => s.id === opts.id) : undefined;
  const byName = !opts.id ? list.find((s) => s.name === name) : undefined;
  const existing = byId ?? byName;
  let saved: SavedControlTheme;
  if (existing) {
    saved = { ...existing, name, baseTheme, look };
    list = list.map((s) => (s.id === existing.id ? saved : s));
  } else {
    if (list.length >= MAX_SAVED_CONTROL_THEMES) {
      return { ok: false, error: `저장한 테마는 ${MAX_SAVED_CONTROL_THEMES}개까지입니다.` };
    }
    saved = { id: newSavedControlThemeId(), name, baseTheme, look };
    list = [...list, saved];
  }
  return {
    ok: true,
    saved,
    config: {
      ...withUiThemes(config, { controlTheme: baseTheme }),
      savedControlThemes: list,
      activeControlThemeId: saved.id,
      controlLook: look,
    },
  };
}

export function deleteSavedControlTheme(config: AppConfig, id: string): AppConfig {
  const base = resolveControlTheme(config);
  const list = normalizeSavedControlThemes(config.savedControlThemes, base).filter((s) => s.id !== id);
  const next = { ...config, savedControlThemes: list };
  if (config.activeControlThemeId === id) return applyControlThemeChoice(next, base);
  return next;
}

export function applyControlLookToDocument(look: ControlLook | null): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (look?.overlay === true && look.bgSet) {
    el.style.setProperty("--bg", look.bg);
    el.style.setProperty(
      "--bg-gradient",
      look.bg2 ? `linear-gradient(145deg, ${look.bg} 0%, ${look.bg2} 100%)` : "none",
    );
    return;
  }
  el.style.removeProperty("--bg");
  el.style.removeProperty("--bg-gradient");
}
