import { getSupabase } from "./client";
import { hashPassword } from "./password";
import { getConfiguredVenueId } from "./venue";
import { matchesNicknameSearch } from "../../shared/chosung";

export type MemberRow = {
  id: string;
  nickname: string;
  login_id: string;
  display_name: string | null;
  phone: string | null;
  floor_status: string;
};

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function searchMemberByNicknameOrLogin(query: string): Promise<MemberRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const q = query.trim();
  if (!q) return null;
  const venueId = getConfiguredVenueId();
  const { data: byNick } = await sb
    .from("members")
    .select("id, nickname, login_id, display_name, phone, floor_status")
    .eq("venue_id", venueId)
    .eq("nickname", q)
    .maybeSingle();
  if (byNick) return byNick as MemberRow;
  const { data: byLogin } = await sb
    .from("members")
    .select("id, nickname, login_id, display_name, phone, floor_status")
    .eq("venue_id", venueId)
    .eq("login_id", normalizeLoginId(q))
    .maybeSingle();
  return (byLogin as MemberRow | null) ?? null;
}

export async function searchMembersByQuery(query: string, limit = 16): Promise<MemberRow[]> {
  const q = query.trim();
  if (!q) return [];

  const exact = await searchMemberByNicknameOrLogin(q);
  if (exact) return [exact];

  const sb = getSupabase();
  if (!sb) return [];
  const venueId = getConfiguredVenueId();

  const { data: partial } = await sb
    .from("members")
    .select("id, nickname, login_id, display_name, phone, floor_status")
    .eq("venue_id", venueId)
    .or(`nickname.ilike.%${q}%,login_id.ilike.%${q}%`)
    .limit(80);

  const fromPartial = (partial ?? []).filter(
    (m) => matchesNicknameSearch(m.nickname, q) || matchesNicknameSearch(m.login_id, q),
  ) as MemberRow[];

  if (fromPartial.length > 0) {
    return fromPartial.slice(0, limit);
  }

  const { data: all } = await sb
    .from("members")
    .select("id, nickname, login_id, display_name, phone, floor_status")
    .eq("venue_id", venueId)
    .order("nickname")
    .limit(500);

  return ((all ?? []) as MemberRow[])
    .filter((m) => matchesNicknameSearch(m.nickname, q) || matchesNicknameSearch(m.login_id, q))
    .slice(0, limit);
}

export type CreateMemberInput = {
  loginId: string;
  password: string;
  nickname: string;
  displayName?: string;
  phone?: string;
};

export async function createMember(input: CreateMemberInput): Promise<{ member: MemberRow } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase에 연결할 수 없습니다." };

  const loginId = normalizeLoginId(input.loginId);
  const nickname = input.nickname.trim();
  const password = input.password;
  if (!loginId || loginId.length < 3) return { error: "아이디는 3자 이상입니다." };
  if (!password || password.length < 4) return { error: "비밀번호는 4자 이상입니다." };
  if (!nickname) return { error: "닉네임을 입력하세요." };

  const venueId = getConfiguredVenueId();
  const { data: nickDup } = await sb.from("members").select("id").eq("venue_id", venueId).eq("nickname", nickname).maybeSingle();
  if (nickDup) return { error: "이미 사용 중인 닉네임입니다." };
  const { data: idDup } = await sb.from("members").select("id").eq("venue_id", venueId).eq("login_id", loginId).maybeSingle();
  if (idDup) return { error: "이미 사용 중인 아이디입니다." };

  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (phone && phone.length < 10) return { error: "전화번호는 10자리 이상이거나 비워 두세요." };

  const passwordHash = await hashPassword(password);
  const { data, error } = await sb
    .from("members")
    .insert({
      venue_id: venueId,
      login_id: loginId,
      password_hash: passwordHash,
      nickname,
      display_name: input.displayName?.trim() || null,
      phone,
      floor_status: "registered",
    })
    .select("id, nickname, login_id, display_name, phone, floor_status")
    .single();

  if (error) return { error: error.message };
  return { member: data as MemberRow };
}
