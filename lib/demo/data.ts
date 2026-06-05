import type {
  ApprovalRequest,
  Game,
  GameClock,
  GameLog,
  GamePreset,
  GameTableAssignment,
  PhysicalTable,
  Seat,
  Member,
} from "@/lib/types";

const now = new Date().toISOString();

export const demoTables: PhysicalTable[] = [
  { id: "tbl-a", code: "A", label: "Table A", is_active: true, current_game_id: null, created_at: now },
  { id: "tbl-b", code: "B", label: "Table B", is_active: true, current_game_id: "game-1", created_at: now },
  { id: "tbl-c", code: "C", label: "Table C", is_active: true, current_game_id: "game-1", created_at: now },
  { id: "tbl-d", code: "D", label: "Table D", is_active: true, current_game_id: "game-2", created_at: now },
];

export const demoPresets: GamePreset[] = [
  {
    id: "preset-1",
    name: "데일리 기본",
    buy_in: 500000,
    blind_structure: [
      { kind: "level", level: 1, small: 100, big: 200, ante: 0, minutes: 20 },
      { kind: "level", level: 2, small: 200, big: 400, ante: 0, minutes: 20 },
      { kind: "level", level: 3, small: 300, big: 600, ante: 600, minutes: 20 },
    ],
    prize_rules: {
      placements: [{ rank: 1, percent: 60 }, { rank: 2, percent: 40 }],
      win_points: [{ rank: 1, points: 150 }, { rank: 2, points: 80 }],
    },
    game_kind: "daily",
    rebuy_cost: 500000,
    addon_enabled: false,
    bonus_enabled: true,
    addon_price: 0,
    buy_in_chips: 30000,
    rebuy_chips: [{ order: 1, chips: 30000 }],
    rebuy1_chips: 30000,
    rebuy2_chips: 0,
    addon_chips: 0,
    bonus_chips: 5000,
    participation_points: 5,
    prize_pool_percent: 80,
    created_at: now,
  },
  {
    id: "preset-2",
    name: "금요일 빅",
    buy_in: 1000000,
    blind_structure: [
      { kind: "level", level: 1, small: 500, big: 1000, ante: 0, minutes: 25 },
      { kind: "level", level: 2, small: 1000, big: 2000, ante: 2000, minutes: 25 },
    ],
    prize_rules: {
      placements: [{ rank: 1, percent: 70 }, { rank: 2, percent: 30 }],
      win_points: [{ rank: 1, points: 200 }, { rank: 2, points: 100 }],
    },
    game_kind: "tournament",
    rebuy_cost: 1000000,
    addon_enabled: true,
    bonus_enabled: true,
    addon_price: 500000,
    buy_in_chips: 50000,
    rebuy_chips: [
      { order: 1, chips: 50000 },
      { order: 2, chips: 50000 },
    ],
    rebuy1_chips: 50000,
    rebuy2_chips: 50000,
    addon_chips: 50000,
    bonus_chips: 10000,
    participation_points: 10,
    prize_pool_percent: 100,
    created_at: now,
  },
];

export const demoGames: Game[] = [
  {
    id: "game-1",
    preset_id: "preset-1",
    venue_id: null,
    venue_session_id: null,
    daily_game_number: 1,
    blind_structure_id: null,
    status: "running",
    mode: "multi_table",
    registration_closed: false,
    entry_count: 18,
    survivor_count: 14,
    rebuy_count: 4,
    total_prize_pool: 0,
    payout_places: 5,
    settlement_status: "none",
    prize_structure_id: null,
    win_point_preset_id: null,
    win_point_multiplier: 1,
    button_seat: 5,
    created_at: now,
    updated_at: now,
  },
  {
    id: "game-2",
    preset_id: "preset-1",
    venue_id: null,
    venue_session_id: null,
    daily_game_number: 2,
    blind_structure_id: null,
    status: "running",
    mode: "single_table",
    registration_closed: true,
    entry_count: 9,
    survivor_count: 6,
    rebuy_count: 1,
    total_prize_pool: 0,
    payout_places: 5,
    settlement_status: "none",
    prize_structure_id: null,
    win_point_preset_id: null,
    win_point_multiplier: 1,
    button_seat: null,
    created_at: now,
    updated_at: now,
  },
];

export const demoClocks: Record<string, GameClock> = {
  "game-1": {
    id: "clock-1",
    game_id: "game-1",
    level: 12,
    remaining_seconds: 1044,
    blind_small: 500,
    blind_big: 1000,
    ante: 1000,
    is_running: true,
    updated_at: now,
    created_at: now,
  },
  "game-2": {
    id: "clock-2",
    game_id: "game-2",
    level: 4,
    remaining_seconds: 720,
    blind_small: 100,
    blind_big: 200,
    ante: 0,
    is_running: true,
    updated_at: now,
    created_at: now,
  },
};

export const demoPlayers: Member[] = [
  { id: "vp-1", venue_id: null, login_id: "player01", nickname: "Player_01", display_name: null, phone: "01011112222", point_balance: 0, credit_balance: 0, rank_tier: null, floor_status: "in_game", user_id: null, created_at: now },
  { id: "vp-2", venue_id: null, login_id: "moon", nickname: "Moon", display_name: "문선우", phone: "01033334444", point_balance: 5000, credit_balance: 0, rank_tier: null, floor_status: "in_game", user_id: null, created_at: now },
  { id: "vp-3", venue_id: null, login_id: "sharky", nickname: "샤키", display_name: null, phone: null, point_balance: 0, credit_balance: 0, rank_tier: null, floor_status: "waiting", user_id: null, created_at: now },
  { id: "vp-4", venue_id: null, login_id: "hong", nickname: "홍길동", display_name: "홍길동", phone: null, point_balance: 0, credit_balance: 0, rank_tier: null, floor_status: "registered", user_id: null, created_at: now },
  { id: "vp-5", venue_id: null, login_id: "aceking", nickname: "AceKing", display_name: null, phone: "01099998888", point_balance: 0, credit_balance: -50000, rank_tier: null, floor_status: "registered", user_id: null, created_at: now },
  { id: "vp-6", venue_id: null, login_id: "nova", nickname: "노바", display_name: "김노바", phone: "01055556666", point_balance: 0, credit_balance: 0, rank_tier: null, floor_status: "registered", user_id: null, created_at: now },
];

export const demoSeats: Seat[] = [
  { id: "s-1", game_id: "game-1", physical_table_id: "tbl-b", seat_number: 1, member_id: "vp-1", member_visit_id: null, seat_status: "occupied", chips: 150000, rebuy_count: 0, buy_in_count: 1, first_payment_method: "credit", last_payment_method: "credit", first_sat_at: now, created_at: now },
  { id: "s-2", game_id: "game-1", physical_table_id: "tbl-b", seat_number: 2, member_id: "vp-2", member_visit_id: null, seat_status: "occupied", chips: 80000, rebuy_count: 1, buy_in_count: 2, first_payment_method: "cash", last_payment_method: "cash", first_sat_at: now, created_at: now },
];

export const demoAssignments: GameTableAssignment[] = [
  { id: "a-1", game_id: "game-1", physical_table_id: "tbl-b", created_at: now },
  { id: "a-2", game_id: "game-1", physical_table_id: "tbl-c", created_at: now },
  { id: "a-3", game_id: "game-2", physical_table_id: "tbl-d", created_at: now },
];

export const demoLogs: GameLog[] = [
  { id: "log-1", game_id: "game-1", physical_table_id: "tbl-c", level: "info", message: "[Table C] 샤키 플레이어 올인 신청", created_at: now },
  { id: "log-2", game_id: "game-1", physical_table_id: "tbl-b", level: "info", message: "[Table B] 블라인드 레벨 업 (300/600)", created_at: now },
];

export const demoApprovals: ApprovalRequest[] = [
  {
    id: "ar-1",
    request_type: "seat_reservation",
    member_id: "vp-5",
    game_id: "game-1",
    physical_table_id: "tbl-b",
    seat_number: 3,
    status: "pending",
    approved_by: null,
    created_at: now,
    members: demoPlayers[4],
  },
];
