export type TimerStatus = "running" | "paused" | "stopped";

export type TimerAction = "start" | "pause" | "stop" | "levelUp" | "levelDown" | "reset" | "setDuration" | "setRemainingMs" | "adjustSec";

export interface BlindLevelDef {
  level: number;
  small: number;
  big: number;
  ante: number;
  durationSec: number;
}

export interface TableTimerState {
  tableId: number;
  status: TimerStatus;
  blindLevel: number;
  endsAt: number | null;
  remainingMs: number | null;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  blindStructureId: string | null;
  blindStructureName: string | null;
  levels: BlindLevelDef[];
}

export interface BlindStructureOption {
  id: string;
  name: string;
  defaultBuyIn: number;
  levels: BlindLevelDef[];
  /** 대회 게임 여부 (false = 데일리) */
  isChampionship: boolean;
  /** 엔트리 지급 칩 */
  entryChip: number;
  /** 리바인별 지급 칩 [1차, 2차, 3차...] */
  rebuyChips: number[];
  /** 리바인 가능 횟수 (rebuyChips.length 와 동일) */
  rebuyCount: number;
  /** 애드온 있음 여부 */
  hasAddon: boolean;
  /** 애드온 칩 */
  addonChip: number;
  /** 보너스칩 있음 여부 */
  hasBonusChip: boolean;
  /** 보너스칩 수량 */
  bonusChipAmount: number;
}
