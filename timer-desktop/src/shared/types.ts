export const CONFIG_VERSION = 2 as const;
export const MAX_MONITORS = 6;
export const MONITOR_SLOTS = [1, 2, 3, 4, 5, 6] as const;
export const TABLE_SLOTS = [1, 2, 3, 4, 5, 6] as const;
export type MonitorSlot = (typeof MONITOR_SLOTS)[number];
export type TableSlot = (typeof TABLE_SLOTS)[number];

export const TABLE_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export function tableLetter(slot: number): string {
  if (slot >= 1 && slot <= TABLE_LETTERS.length) return TABLE_LETTERS[slot - 1];
  return String(slot);
}

export function tableName(slot: number): string {
  return `${tableLetter(slot)} 테이블`;
}

/** 송출·컨트롤러 UI 테마 */
export const UI_THEME_IDS = ["black-pink", "mnf-original", "cherry-blossom"] as const;
export type UiThemeId = (typeof UI_THEME_IDS)[number];
export const DEFAULT_UI_THEME: UiThemeId = "black-pink";
export const UI_THEME_OPTIONS: ReadonlyArray<{ id: UiThemeId; label: string }> = [
  { id: "black-pink", label: "Black Pink" },
  { id: "mnf-original", label: "MNF Original" },
  { id: "cherry-blossom", label: "Cherry Blossom" },
];

export function isUiThemeId(value: unknown): value is UiThemeId {
  return typeof value === "string" && (UI_THEME_IDS as readonly string[]).includes(value);
}

export function normalizeUiTheme(value: unknown): UiThemeId {
  return isUiThemeId(value) ? value : DEFAULT_UI_THEME;
}

export function applyDocumentTheme(theme: UiThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export const DEFAULT_SOUND_VOLUME = 100;

export function normalizeSoundVolume(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SOUND_VOLUME;
  return Math.round(Math.min(100, Math.max(0, n)));
}

/** 역삼: 허브(control)가 게임·슬롯 할당을 들고, 출력 PC는 같은 슬롯을 따라감. 화면 매핑과 별개. */
export const YEOKSAM_ROLES = ["control", "output"] as const;
export type YeoksamRole = (typeof YEOKSAM_ROLES)[number];
export const DEFAULT_YEOKSAM_ROLE: YeoksamRole = "control";

export function isYeoksamRole(value: unknown): value is YeoksamRole {
  return value === "control" || value === "output";
}

export function normalizeYeoksamRole(value: unknown): YeoksamRole {
  return isYeoksamRole(value) ? value : DEFAULT_YEOKSAM_ROLE;
}

// legacy compat
export const MAX_GAMES = MAX_MONITORS;
export const MAX_TABLE_DISPLAYS = MAX_MONITORS;
export const GAME_NUMBERS = MONITOR_SLOTS;
export type GameNumber = MonitorSlot;
export type TableNumber = TableSlot;
export const TABLE_NUMBERS = TABLE_SLOTS;

export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 물리 모니터 1개의 설정.
 * monitorSlot: 매장 내 M1~M6 번호
 * gameId: 현재 이 모니터에 표시할 게임 ID (null = 미사용)
 */
export interface MonitorMapping {
  displayId: number;
  monitorSlot: MonitorSlot;
  gameId: number | null;
  label?: string;
  bounds?: DisplayBounds;
  // legacy
  monitorIndex?: number;
  gameNumber?: number | null;
}

export interface AppConfig {
  version: typeof CONFIG_VERSION;
  controlDisplayId: number;
  mappings: MonitorMapping[];
  /** UI 테마. 없으면 Black Pink */
  theme?: UiThemeId;
  /** 타이머 효과음 볼륨 0–100. 없으면 100 */
  soundVolume?: number;
  /** 이 PC가 속한 지점. 없으면 역삼 */
  venueId?: string;
  /** 역삼: 관리자 창이 이 슬롯 송출을 대신 보여 줌. Esc로 설정. */
  controlOutputSlot?: MonitorSlot | null;
  /** 역삼 매장 역할. 없으면 컨트롤(기존 단일 PC와 동일) */
  yeoksamRole?: YeoksamRole;
}

export interface DisplayInfo {
  id: number;
  label: string;
  bounds: DisplayBounds;
  workArea: DisplayBounds;
  scaleFactor: number;
  rotation: number;
  internal: boolean;
  isPrimary: boolean;
}

/** 송출 화면 좌측 문구 (리치 텍스트 HTML) */
export interface LeftNotice {
  html: string;
}

/** @deprecated 레거시 줄 단위 문구 — LeftNotice.html로 이전 */
export interface LeftNoticeLine {
  id: string;
  text: string;
  fontSize: number;
  color: string;
}

/** Control 창에서 관리하는 진행 중인 게임 세션 */
export interface GameSession {
  gameId: number;
  structureId: string;
  structureName: string;
  tableIds: TableSlot[];
  /**
   * 같은 게임이 테이블 2개 이상에 한 번이라도 붙으면 true.
   * 이후 테이블을 빼도 MTT 문구를 유지한다.
   */
  isMtt?: boolean;
  // 블라인드 구조 옵션 (UI 표시용)
  isChampionship: boolean;
  entryChip: number;
  rebuyChips: number[];    // [1차칩, 2차칩, ...]
  rebuyCount: number;
  hasAddon: boolean;
  addonChip: number;
  hasBonusChip: boolean;
  bonusChipAmount: number;
  /**
   * 최초 시작 Unix ms. 0 = 아직 한 번도 시작 안 함.
   * TOTAL TIME 표시용 기준(일시정지 반영은 totalElapsedMs / totalRunningAt).
   */
  startedAt: number;
  /** 일시정지 구간에 누적된 플레이 시간(ms) */
  totalElapsedMs: number;
  /** running 중이면 구간 시작 시각, 아니면 null */
  totalRunningAt: number | null;
  // 게임 내 카운터
  /** 현재 남은 플레이어 수 */
  players: number;
  /** 총 엔트리 수 (= 최대 플레이어, 엔트리 +시 players도 동시 증가) */
  entries: number;
  /** 리바인 횟수 [1차, 2차, ...] */
  rebuys: number[];
  addon: number;
  bonusChip: number;
  /** 송출 좌측 패널 문구. null = 없음 */
  leftNotice: LeftNotice | null;
}

/** 세션 TOTAL TIME 표시용 경과 ms (일시정지 반영) */
export function getSessionTotalElapsedMs(session: Pick<GameSession, "totalElapsedMs" | "totalRunningAt">, now = Date.now()): number {
  const base = session.totalElapsedMs ?? 0;
  if (session.totalRunningAt && isFinite(session.totalRunningAt)) {
    return base + Math.max(0, now - session.totalRunningAt);
  }
  return base;
}

export function formatTotalElapsedMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 좌측 문구 HTML 살균 (스크립트/이벤트 제거) */
export function sanitizeNoticeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

export function noticeHtmlIsEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0;
}

/** Control 창에 전달하는 전체 앱 상태 스냅샷 */
export interface AppSnapshot {
  sessions: GameSession[];
  /** monitorSlot → gameId */
  monitorAssignments: Record<number, number | null>;
  /** tableSlot → gameId */
  tableAssignments: Record<number, number | null>;
}

export function createEmptyConfig(controlDisplayId: number): AppConfig {
  return {
    version: CONFIG_VERSION,
    controlDisplayId,
    mappings: [],
    theme: DEFAULT_UI_THEME,
    soundVolume: DEFAULT_SOUND_VOLUME,
  };
}
