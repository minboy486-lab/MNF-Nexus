"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkInVisit,
  checkNicknameAvailable,
  checkLoginIdAvailable,
  createMember,
  lookupMemberByNicknameOrLogin,
} from "@/lib/actions/members";
import type { Member, VenueSession } from "@/lib/types";
import { formatChips } from "@/lib/utils/format";

type Props = {
  session: VenueSession | null;
};

export function CounterClient({ session }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"visit" | "register">("visit");
  const [query, setQuery] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [nickOk, setNickOk] = useState<boolean | null>(null);
  const [loginOk, setLoginOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!nickname.trim()) {
      setNickOk(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await checkNicknameAvailable(nickname);
      setNickOk(res.available ?? false);
    }, 400);
    return () => clearTimeout(t);
  }, [nickname]);

  useEffect(() => {
    if (!loginId.trim()) {
      setLoginOk(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await checkLoginIdAvailable(loginId);
      setLoginOk(res.available ?? false);
    }, 400);
    return () => clearTimeout(t);
  }, [loginId]);

  async function handleSearch() {
    setError(null);
    setMember(null);
    const res = await lookupMemberByNicknameOrLogin(query);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    if (!res?.member) {
      setError("등록된 손님이 없습니다. 신규 등록 탭을 이용하세요.");
      return;
    }
    setMember(res.member);
  }

  async function handleCheckIn() {
    if (!session) {
      setError("영업이 열려 있지 않습니다.");
      return;
    }
    if (!member) return;
    const res = await checkInVisit(member.id);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    setQuery("");
    setMember(null);
    router.refresh();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!session) {
      setError("영업이 열려 있지 않습니다.");
      return;
    }
    const res = await createMember({
      loginId,
      password,
      nickname,
      displayName: displayName || undefined,
      phone: phone || undefined,
    });
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setTab("visit");
    setError(null);
    router.refresh();
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {!session && (
        <p className="text-center text-amber-400 text-sm">
          관리자 대시보드에서 영업을 시작한 뒤 이용하세요.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("visit")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${
            tab === "visit" ? "bg-primary/20 border border-primary text-primary" : "border border-white/10"
          }`}
        >
          방문 처리
        </button>
        <button
          type="button"
          onClick={() => setTab("register")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${
            tab === "register" ? "bg-primary/20 border border-primary text-primary" : "border border-white/10"
          }`}
        >
          신규 등록
        </button>
      </div>

      {tab === "visit" && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <label className="text-sm text-on-surface-variant">닉네임 또는 아이디</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="login-input w-full text-lg"
            placeholder="검색"
          />
          <button
            type="button"
            disabled={!session || !query.trim()}
            onClick={handleSearch}
            className="btn-primary w-full py-3 rounded-xl"
          >
            조회
          </button>

          {member && (
            <div className="border border-primary/30 rounded-xl p-4 space-y-3">
              <p className="text-2xl font-bold">{member.nickname}</p>
              <p className="text-xs text-on-surface-variant">
                {member.login_id}
                {member.display_name ? ` · ${member.display_name}` : ""}
              </p>
              <button
                type="button"
                disabled={!session}
                onClick={handleCheckIn}
                className="btn-primary w-full py-3 rounded-xl"
              >
                방문 중으로 등록
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "register" && (
        <form onSubmit={handleRegister} className="glass-panel rounded-2xl p-6 space-y-3">
          <label className="text-sm block">
            아이디 *
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className={`login-input w-full mt-1 ${loginOk === false ? "border-error" : ""}`}
              required
            />
            {loginOk === false && <span className="text-error text-xs">중복 아이디</span>}
          </label>
          <label className="text-sm block">
            비밀번호 *
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input w-full mt-1"
              required
              minLength={4}
            />
          </label>
          <label className="text-sm block">
            닉네임 *
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={`login-input w-full mt-1 ${nickOk === false ? "border-error" : ""}`}
              required
            />
            {nickOk === false && <span className="text-error text-xs">중복 닉네임</span>}
          </label>
          <label className="text-sm block">
            이름
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="login-input w-full mt-1"
            />
          </label>
          <label className="text-sm block">
            전화번호
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="login-input w-full mt-1"
              inputMode="tel"
            />
          </label>
          <button
            type="submit"
            disabled={
              !session || nickOk !== true || loginOk !== true
            }
            className="w-full bg-tertiary/30 border border-tertiary/50 font-bold py-3 rounded-xl disabled:opacity-40"
          >
            손님 등록 (방문은 별도)
          </button>
        </form>
      )}

      {error && <p className="text-error text-sm text-center">{error}</p>}

      <p className="text-xs text-on-surface-variant text-center">
        방문 손님·좌석 배정은 관리자 「손님 관리」에서도 할 수 있습니다.
      </p>
    </div>
  );
}
