export const CONFIG_VERSION = 2 as const;
export const MAX_MONITORS = 6;
export const MONITOR_SLOTS = [1, 2, 3, 4, 5, 6] as const;
export const TABLE_SLOTS = [1, 2, 3, 4, 5, 6] as const;
export type MonitorSlot = (typeof MONITOR_SLOTS)[number];
export type TableSlot = (typeof TABLE_SLOTS)[number];

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

/** Control 창에서 관리하는 진행 중인 게임 세션 */
export interface GameSession {
  gameId: number;
  structureId: string;
  structureName: string;
  tableIds: TableSlot[];
  // 블라인드 구조 옵션 (UI 표시용)
  isChampionship: boolean;
  entryChip: number;
  rebuyChips: number[];    // [1차칩, 2차칩, ...]
  rebuyCount: number;
  hasAddon: boolean;
  addonChip: number;
  hasBonusChip: boolean;
  bonusChipAmount: number;
  /** 게임 시작 Unix ms (Date.now()) */
  startedAt: number;
  // 게임 내 카운터
  /** 현재 남은 플레이어 수 */
  players: number;
  /** 총 엔트리 수 (= 최대 플레이어, 엔트리 +시 players도 동시 증가) */
  entries: number;
  /** 리바인 횟수 [1차, 2차, ...] */
  rebuys: number[];
  addon: number;
  bonusChip: number;
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
  };
}
