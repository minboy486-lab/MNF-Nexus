export type UserRole = "admin" | "staff" | "guest";
export type FloorStatus = "visitor" | "waiting" | "in_game" | "reserved";
export type GameMode = "single_table" | "multi_table";

export type BlindLevel = {
  level: number;
  small: number;
  big: number;
  ante: number;
  minutes: number;
};

export type Profile = {
  id: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
};

export type PhysicalTable = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  current_game_id: string | null;
  created_at: string;
};

export type GamePreset = {
  id: string;
  name: string;
  buy_in: number;
  blind_structure: BlindLevel[];
  prize_rules: unknown | null;
  created_at: string;
};

export type GameStatus =
  | "scheduled"
  | "running"
  | "registration_closed"
  | "ended"
  | "settled";

export type Game = {
  id: string;
  preset_id: string | null;
  venue_id: string | null;
  venue_session_id: string | null;
  daily_game_number: number | null;
  blind_structure_id: string | null;
  status: GameStatus;
  mode: GameMode;
  registration_closed: boolean;
  entry_count: number;
  survivor_count: number;
  rebuy_count: number;
  total_prize_pool: number;
  payout_places: number;
  settlement_status: "none" | "in_progress" | "finalized";
  prize_structure_id: string | null;
  win_point_preset_id: string | null;
  win_point_multiplier: number;
  created_at: string;
  updated_at: string;
};

export type PrizePlacement = { rank: number; percent: number };

export type PrizeStructure = {
  id: string;
  venue_id: string | null;
  name: string;
  game_kind: string;
  max_entries: number | null;
  default_payout_places: number;
  placements: PrizePlacement[];
  created_at: string;
};

export type GameFinishPlacement = {
  id: string;
  game_id: string;
  member_id: string;
  finish_rank: number;
  chips_at_elim: number | null;
  suggested_amount: number;
  final_amount: number;
  paid_at: string | null;
  created_at: string;
  members?: Member;
};

export type GameIcmChop = {
  id: string;
  game_id: string;
  remaining_pool: number;
  inputs: unknown;
  results: unknown;
  finalized: boolean;
  updated_at: string;
};

export type PointTransferRequest = {
  id: string;
  venue_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  status: string;
  message: string | null;
  created_at: string;
};

export type GameClock = {
  id: string;
  game_id: string;
  level: number;
  remaining_seconds: number;
  blind_small: number;
  blind_big: number;
  ante: number;
  is_running: boolean;
  updated_at: string;
  created_at: string;
};

export type Member = {
  id: string;
  venue_id: string | null;
  nickname: string;
  phone: string | null;
  point_balance: number;
  credit_balance: number;
  rank_tier: string | null;
  floor_status: FloorStatus;
  user_id: string | null;
  created_at: string;
};

/** @deprecated use Member */
export type VenuePlayer = Member;

export type VenueSession = {
  id: string;
  venue_id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  created_at: string;
};

export type MemberVisit = {
  id: string;
  venue_id: string;
  venue_session_id: string;
  member_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  status: "on_floor" | "left";
  created_at: string;
  members?: Member;
};

export type MemberVisitWithMember = MemberVisit & {
  members: Member;
};

export type Seat = {
  id: string;
  game_id: string;
  physical_table_id: string;
  seat_number: number;
  member_id: string | null;
  member_visit_id: string | null;
  seat_status: "empty" | "occupied" | "sit_out";
  chips: number;
  rebuy_count: number;
  first_sat_at: string | null;
  created_at: string;
  members?: Member | null;
};

export type GameTableAssignment = {
  id: string;
  game_id: string;
  physical_table_id: string;
  created_at: string;
  physical_tables?: PhysicalTable;
};

export type ApprovalRequest = {
  id: string;
  request_type: string;
  member_id: string;
  game_id: string | null;
  physical_table_id: string | null;
  seat_number: number | null;
  status: string;
  approved_by: string | null;
  created_at: string;
  members?: Member;
};

export type GameLog = {
  id: string;
  game_id: string | null;
  physical_table_id: string | null;
  level: string;
  message: string;
  created_at: string;
};

export type GameWithRelations = Game & {
  game_clocks: GameClock | GameClock[] | null;
  game_presets: GamePreset | null;
  game_table_assignments: (GameTableAssignment & {
    physical_tables: PhysicalTable;
  })[];
};
