export const DEFAULT_BINGO_MISSIONS = [
  "바이인 1회",
  "바이인 3회",
  "리바이 1회",
  "ITM 1회",
  "1등 1회",
  "2등 1회",
  "3등 1회",
  "하이핸드 달성",
  "연승 2회",
  "올인승 1회",
  "쇼다운 3회",
  "폴드승 1회",
  "21시 이후 게임",
  "주말 게임 1회",
  "신규 테이블 참여",
  "빙고 완성",
] as const;

/** 기본 미션 목록에서 「하이핸드 달성」 칸 번호 */
export const HIGH_HAND_BINGO_CELL_NO = 8;

export type BingoMark = {
  id: string;
  month_key: string;
  cell_no: number;
  nickname: string;
  member_id: string | null;
  created_at: string;
};

export type BingoMonthSheet = {
  month_key: string;
  cell_labels: string[];
  marks: BingoMark[];
};

export const HIGH_HAND_TYPES = [
  { id: "four_kind" as const, label: "포카드", mp: 5 },
  { id: "straight_flush" as const, label: "스티플", mp: 15 },
  { id: "royal_flush" as const, label: "로티플", mp: 20 },
] as const;

export type HighHandType = (typeof HIGH_HAND_TYPES)[number]["id"];

export type HighHandEntry = {
  id: string;
  play_date: string;
  hand_type: HighHandType;
  nickname: string;
  member_id: string | null;
  mp_points: number;
  note: string | null;
};

export function currentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthKeyFromPlayDate(playDate: string): string {
  return playDate.slice(0, 7);
}

export function formatMonthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

export function monthKeyToRange(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${String(m).padStart(2, "0")}-01`,
    to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
  };
}
