"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  lookupAndCheckIn,
  registerMember,
} from "@/lib/actions/members";
import type { Member, VenueSession } from "@/lib/types";
import { formatChips } from "@/lib/utils/format";

type Props = {
  session: VenueSession | null;
};

export function CounterClient({ session }: Props) {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [nickname, setNickname] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"lookup" | "register">("lookup");

  function appendDigit(d: string) {
    if (digits.length >= 11) return;
    setDigits((prev) => prev + d);
    setError(null);
  }

  function backspace() {
    setDigits((prev) => prev.slice(0, -1));
  }

  async function handleLookup() {
    if (!session) {
      setError("영업이 열려 있지 않습니다.");
      return;
    }
    const res = await lookupAndCheckIn(digits);
    if ("error" in res && res.error) {
      setError(res.error);
      setMember(null);
      if (res.error.includes("등록된 회원이 없")) setMode("register");
      return;
    }
    setMember("member" in res ? (res.member ?? null) : null);
    setError(null);
    router.refresh();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!session) {
      setError("영업이 열려 있지 않습니다.");
      return;
    }
    const res = await registerMember(digits, nickname);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setMember("member" in res ? (res.member ?? null) : null);
    setError(null);
    setMode("lookup");
    router.refresh();
  }

  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {!session && (
        <p className="text-center text-amber-400 text-sm">
          관리자 대시보드에서 영업을 시작한 뒤 이용하세요.
        </p>
      )}

      <div className="glass-panel rounded-2xl p-6">
        <p className="text-xs text-on-surface-variant mb-2">전화번호</p>
        <p className="text-3xl font-bold tabular-nums tracking-widest min-h-[2.5rem]">
          {digits || "—"}
        </p>

        <div className="grid grid-cols-3 gap-2 mt-6">
          {keypad.map((key) => (
            <button
              key={key}
              type="button"
              disabled={!session}
              onClick={() => {
                if (key === "clear") setDigits("");
                else if (key === "back") backspace();
                else appendDigit(key);
              }}
              className="h-14 rounded-xl bg-surface-container-high text-xl font-bold hover:bg-primary/20 disabled:opacity-40"
            >
              {key === "back" ? "⌫" : key === "clear" ? "C" : key}
            </button>
          ))}
        </div>

        {error && <p className="text-error text-sm mt-4">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            disabled={!session || digits.length < 10}
            onClick={handleLookup}
            className="btn-primary flex-1 py-3 rounded-xl"
          >
            조회 · 방문 등록
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "register" ? "lookup" : "register");
              setError(null);
            }}
            className="px-4 border border-outline-variant rounded-xl text-sm"
          >
            {mode === "register" ? "조회" : "신규"}
          </button>
        </div>
      </div>

      {mode === "register" && (
        <form onSubmit={handleRegister} className="glass-panel rounded-2xl p-6 space-y-4">
          <label className="block text-sm text-on-surface-variant">닉네임 (신규)</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-surface-container-low border border-white/10 rounded-lg py-3 px-4"
            placeholder="매장 닉네임"
          />
          <button
            type="submit"
            disabled={!session}
            className="w-full bg-tertiary/30 border border-tertiary/50 font-bold py-3 rounded-xl"
          >
            가입 + 방문 등록
          </button>
        </form>
      )}

      {member && (
        <div className="glass-panel rounded-2xl p-6 border border-primary/30">
          <p className="text-xs text-primary font-bold uppercase mb-2">회원 정보</p>
          <p className="text-2xl font-bold">{member.nickname}</p>
          <p className="text-sm text-on-surface-variant mt-1">{member.phone}</p>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div>
              <p className="text-on-surface-variant">포인트</p>
              <p className="font-bold text-primary">{formatChips(member.point_balance)}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">외상</p>
              <p
                className={`font-bold ${
                  member.credit_balance < 0 ? "text-error" : "text-on-surface"
                }`}
              >
                {member.credit_balance < 0
                  ? formatChips(member.credit_balance)
                  : "0"}
              </p>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">
            방문 목록에 올라갔습니다. 테이블 Seat 배정은 관리자 화면에서 진행하세요.
          </p>
        </div>
      )}
    </div>
  );
}
