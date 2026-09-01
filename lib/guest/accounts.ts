export const GUEST_DEFAULT_PASSWORD = "123456";

export type GuestAccountRow = {
  member_id: string;
  user_id: string | null;
  login_id: string;
  nickname: string;
  display_name: string | null;
  phone: string | null;
  point_balance: number;
  credit_balance: number;
  last_sign_in_at: string | null;
};
