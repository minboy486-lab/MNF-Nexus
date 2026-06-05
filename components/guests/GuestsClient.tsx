"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalRequest, Member, MemberVisitWithMember } from "@/lib/types";
import { checkInVisit, checkInVisits, checkOutVisit } from "@/lib/actions/members";
import { MemberRegisterModal } from "@/components/guests/MemberRegisterForm";
import { formatMp } from "@/lib/utils/mp";
import { matchesNicknameSearch } from "@/lib/utils/chosung";

type SortMode = "visits" | "name";

type Props = {
  members: Member[];
  visits: MemberVisitWithMember[];
  visitingMemberIds: string[];
  visitCounts: Record<string, number>;
  pending: ApprovalRequest[];
  approveAction: (requestId: string) => Promise<void>;
};

const rowBase =
  "w-full text-left px-2 py-1.5 rounded-md border text-sm transition-colors";

function MemberRow({
  member,
  visitCount,
  selected,
  onSelect,
}: {
  member: Member;
  visitCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${rowBase} flex items-center gap-2 ${
        selected
          ? "border-primary bg-primary/15 ring-1 ring-primary/40 font-semibold"
          : "border-white/10 bg-surface-container-low/40 hover:border-primary/30 hover:bg-primary/5"
      }`}
    >
      <span
        className={`material-symbols-outlined text-base shrink-0 ${
          selected ? "text-primary" : "text-on-surface-variant/50"
        }`}
        aria-hidden
      >
        {selected ? "check_box" : "check_box_outline_blank"}
      </span>
      <span className="truncate flex-1 min-w-0">{member.nickname}</span>
      {visitCount > 0 && (
        <span className="text-[10px] tabular-nums text-on-surface-variant/70 shrink-0">
          {visitCount}
        </span>
      )}
    </button>
  );
}

function VisitRow({
  visit,
  selected,
  onSelect,
}: {
  visit: MemberVisitWithMember;
  selected: boolean;
  onSelect: () => void;
}) {
  const m = visit.members;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${rowBase} flex items-center justify-between gap-1 ${
        selected
          ? "border-primary bg-primary/15 ring-1 ring-primary/40 font-semibold"
          : "border-primary/20 bg-surface-container-low/40 hover:border-primary/40 hover:bg-primary/5"
      }`}
    >
      <span className="truncate">{m?.nickname}</span>
      {m && m.credit_balance < 0 && (
        <span className="text-error text-xs font-bold tabular-nums shrink-0">
          {formatMp(m.credit_balance)}
        </span>
      )}
    </button>
  );
}

function GuestListPanel({
  title,
  accentClass,
  count,
  hint,
  children,
  empty,
}: {
  title: string;
  accentClass: string;
  count: number;
  hint: string;
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  return (
    <section className="glass-panel rounded-xl p-3 flex flex-col min-h-0 h-full border border-white/5">
      <header className="shrink-0 mb-2">
        <h2 className="font-bold text-base flex items-center gap-2">
          <span className={`w-1 h-4 rounded-full ${accentClass}`} />
          {title}
          <span className="text-on-surface-variant font-normal text-sm">({count})</span>
        </h2>
        <p className="text-[11px] text-on-surface-variant mt-0.5">{hint}</p>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-0.5">
        {children}
      </div>
      {empty}
    </section>
  );
}

function compareMembers(
  a: Member,
  b: Member,
  visitCounts: Record<string, number>,
  mode: SortMode,
) {
  if (mode === "name") {
    return a.nickname.localeCompare(b.nickname, "ko");
  }
  const diff = (visitCounts[b.id] ?? 0) - (visitCounts[a.id] ?? 0);
  if (diff !== 0) return diff;
  return a.nickname.localeCompare(b.nickname, "ko");
}

export function GuestsClient({
  members,
  visits,
  visitingMemberIds,
  visitCounts,
  pending,
  approveAction,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("visits");
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const selectedMemberCount = selectedMemberIds.size;

  const visitingSet = useMemo(() => new Set(visitingMemberIds), [visitingMemberIds]);

  const pool = useMemo(() => {
    const q = search.trim();
    const filtered = members.filter((m) => {
      if (visitingSet.has(m.id)) return false;
      if (!q) return true;
      return matchesNicknameSearch(m.nickname, q);
    });
    return [...filtered].sort((a, b) => compareMembers(a, b, visitCounts, sortMode));
  }, [members, visitingSet, search, visitCounts, sortMode]);

  const poolCount = members.length - visitingSet.size;

  function toggleMemberSelection(memberId: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
    setSelectedVisitId(null);
  }

  async function handleCheckIn() {
    if (selectedMemberCount === 0) return;
    setMoving(true);
    setError(null);
    const res = await checkInVisits([...selectedMemberIds]);
    setMoving(false);
    if (res && "error" in res && res.error && !("succeeded" in res)) {
      setError(res.error);
      return;
    }
    if (res && "succeeded" in res) {
      const failed = res.failed ?? [];
      if (failed.length > 0) {
        const okCount = res.succeeded?.length ?? 0;
        setError(
          okCount > 0
            ? `${okCount}명 방문 중 · ${failed.length}명 실패 (${failed[0].error})`
            : failed[0].error,
        );
      }
    }
    setSelectedMemberIds(new Set());
    router.refresh();
  }

  async function handleCheckOut() {
    if (!selectedVisitId) return;
    setMoving(true);
    setError(null);
    const res = await checkOutVisit(selectedVisitId);
    setMoving(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setSelectedVisitId(null);
    router.refresh();
  }

  async function handleApprove(id: string) {
    await approveAction(id);
    router.refresh();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="shrink-0 flex items-center gap-2 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="닉네임 검색 (초성 가능)"
          className="login-input flex-1 min-w-[12rem] text-sm py-2"
        />
        <div
          className="flex shrink-0 rounded-lg border border-white/10 overflow-hidden text-xs"
          role="group"
          aria-label="정렬"
        >
          <button
            type="button"
            onClick={() => setSortMode("visits")}
            className={`px-3 py-2 font-medium transition-colors ${
              sortMode === "visits"
                ? "bg-primary/20 text-primary"
                : "text-on-surface-variant hover:bg-white/5"
            }`}
          >
            방문순
          </button>
          <button
            type="button"
            onClick={() => setSortMode("name")}
            className={`px-3 py-2 font-medium transition-colors border-l border-white/10 ${
              sortMode === "name"
                ? "bg-primary/20 text-primary"
                : "text-on-surface-variant hover:bg-white/5"
            }`}
          >
            이름순
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowRegister(true)}
          className="btn-primary inline-flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          손님 등록
        </button>
      </div>

      {error && (
        <p className="shrink-0 text-error text-sm glass-panel p-2 rounded-lg border border-error/30">
          {error}
        </p>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] gap-2 md:gap-3">
        <GuestListPanel
          title="전체 손님"
          accentClass="bg-secondary"
          count={poolCount}
          hint={
            selectedMemberCount > 0
              ? `${selectedMemberCount}명 선택 · › 방문 중`
              : sortMode === "visits"
                ? "복수 선택 가능 · 방문 많은 순 · › 방문 중"
                : "복수 선택 가능 · 이름순 · › 방문 중"
          }
          empty={
            pool.length === 0 ? (
              <p className="shrink-0 text-on-surface-variant text-xs text-center py-4">
                {search ? "검색 결과 없음" : "등록된 손님 없음"}
              </p>
            ) : undefined
          }
        >
          <ul className="space-y-1">
            {pool.map((m) => (
              <li key={m.id}>
                <MemberRow
                  member={m}
                  visitCount={visitCounts[m.id] ?? 0}
                  selected={selectedMemberIds.has(m.id)}
                  onSelect={() => toggleMemberSelection(m.id)}
                />
              </li>
            ))}
          </ul>
        </GuestListPanel>

        <div className="flex flex-col items-center justify-center gap-2 shrink-0 self-stretch py-4">
          <button
            type="button"
            disabled={selectedMemberCount === 0 || moving}
            onClick={() => handleCheckIn()}
            title={selectedMemberCount > 1 ? `${selectedMemberCount}명 방문 중으로` : "방문 중으로"}
            aria-label="방문 중으로 이동"
            className="relative flex items-center justify-center w-11 h-11 rounded-full border border-primary/50 bg-primary/20 text-primary hover:bg-primary/35 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[26px]">chevron_right</span>
            {selectedMemberCount > 1 && (
              <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">
                {selectedMemberCount}
              </span>
            )}
          </button>
          <button
            type="button"
            disabled={!selectedVisitId || moving}
            onClick={() => handleCheckOut()}
            title="퇴장"
            aria-label="퇴장 처리"
            className="flex items-center justify-center w-11 h-11 rounded-full border border-white/20 bg-surface-container-high/80 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[26px]">chevron_left</span>
          </button>
        </div>

        <GuestListPanel
          title="방문 중"
          accentClass="bg-primary"
          count={visits.length}
          hint="선택 후 ‹ 퇴장"
          empty={
            visits.length === 0 ? (
              <p className="shrink-0 text-on-surface-variant text-xs text-center py-4">
                방문 중인 손님 없음
              </p>
            ) : undefined
          }
        >
          <ul className="space-y-1">
            {visits.map((v) => (
              <li key={v.id}>
                <VisitRow
                  visit={v}
                  selected={selectedVisitId === v.id}
                  onSelect={() => {
                    setSelectedVisitId(v.id);
                    setSelectedMemberIds(new Set());
                  }}
                />
              </li>
            ))}
          </ul>
        </GuestListPanel>
      </div>

      {pending.length > 0 && (
        <section className="shrink-0 max-h-28 overflow-y-auto glass-panel rounded-xl p-3 border border-primary/30">
          <h2 className="font-bold text-primary text-sm mb-2">승인 대기</h2>
          <ul className="space-y-1">
            {pending.map((req) => (
              <li
                key={req.id}
                className="flex justify-between items-center text-xs border-b border-outline-variant/20 pb-1"
              >
                <span className="truncate">
                  {req.members?.nickname ?? req.member_id} — {req.request_type}
                </span>
                <button
                  type="button"
                  onClick={() => handleApprove(req.id)}
                  className="text-primary font-bold hover:underline shrink-0 ml-2"
                >
                  승인
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showRegister && <MemberRegisterModal onClose={() => setShowRegister(false)} />}
    </div>
  );
}
