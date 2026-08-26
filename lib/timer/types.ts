export type TimerStatus = "running" | "paused" | "stopped";

export type TimerAction = "start" | "pause" | "stop" | "levelUp" | "levelDown" | "reset" | "setDuration" | "setRemainingMs" | "adjustSec";

export type PauseKind = "break" | "reg-close";

export interface BlindLevelDef {
  level: number;
  small: number;
  big: number;
  ante: number;
  durationSec: number;
  /** 쉬는 시간 vs 레지 마감. 둘 다 small/big 0. */
  pauseKind?: PauseKind;
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
  pauseKind?: PauseKind | null;
  blindStructureId: string | null;
  blindStructureName: string | null;
  levels: BlindLevelDef[];
  /** 버튼으로 레벨을 바꾼 경우 true. 블라인드업 안내음을 내지 않음 */
  muteLevelAnnounce?: boolean;
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
