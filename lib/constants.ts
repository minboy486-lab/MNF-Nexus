export const PHYSICAL_TABLE_CODES = ["A", "B", "C", "D"] as const;
export type PhysicalTableCode = (typeof PHYSICAL_TABLE_CODES)[number];

export const COMBINE_PRIORITY: PhysicalTableCode[] = ["D", "B", "C", "A"];
export const SPLIT_ORDER: PhysicalTableCode[] = ["D", "B", "C", "A"];

export const FLOOR_STATUS_LABELS: Record<string, string> = {
  visitor: "방문",
  waiting: "대기",
  in_game: "게임중",
  reserved: "예약",
};

export const MAX_SEATS_PER_TABLE = 11;
