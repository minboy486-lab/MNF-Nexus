"use client";

import { useMemo, useState } from "react";
import type { Member, MemberVisitWithMember } from "@/lib/types";
import { PointAdjustPanel } from "@/components/guests/PointAdjustPanel";
import { NicknameAutocomplete } from "@/components/scores/NicknameAutocomplete";
import type { MemberSuggestion } from "@/lib/scores/types";
import { formatPaymentDue } from "@/lib/utils/payment-due";
import { formatMp } from "@/lib/utils/mp";

type Props = {
  members: Member[];
  visits: MemberVisitWithMember[];
  visitCounts: Record<string, number>;
};

export function GuestPointsClient({ members, visits, visitCounts }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const memberSuggestions = useMemo(
    (): MemberSuggestion[] =>
      members.map((m) => ({
        id: m.id,
        nickname: m.nickname,
        display_name: m.display_name,
        visit_count: visitCounts[m.id] ?? 0,
      })),
    [members, visitCounts],
  );

  const visitingMembers = useMemo(() => {
    const list: Member[] = [];
    const seen = new Set<string>();
    for (const visit of visits) {
      const m = visit.members;
      if (!m || seen.has(m.id)) continue;
      seen.add(m.id);
      list.push(m);
    }
    return list.sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));
  }, [visits]);

  const selected = selectedId ? (members.find((m) => m.id === selectedId) ?? null) : null;

  function selectMember(memberId: string) {
    setSelectedId(memberId);
    const member = members.find((m) => m.id === memberId);
    if (member) setSearch(member.nickname);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <section className="glass-panel rounded-xl p-3 border border-white/5 shrink-0">
        <header className="mb-2">
          <h2 className="font-bold text-base flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-primary" />
            방문 중
            <span className="text-on-surface-variant font-normal text-sm">
              ({visitingMembers.length})
            </span>
          </h2>
        </header>
        {visitingMembers.length === 0 ? (
          <p className="text-on-surface-variant text-xs py-2">방문 중인 손님이 없습니다.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {visitingMembers.map((m) => {
              const active = selectedId === m.id;
              const paymentDue = formatPaymentDue(m.credit_balance);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => selectMember(m.id)}
                    className={`inline-flex flex-col items-start px-3 py-2 rounded-lg border text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary/15 ring-1 ring-primary/40"
                        : "border-primary/25 bg-surface-container-low/40 hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <span className="font-semibold">{m.nickname}</span>
                    <span className="text-primary text-[11px] font-bold tabular-nums mt-0.5">
                      {formatMp(m.point_balance)}
                    </span>
                    {paymentDue && (
                      <span className="text-error text-[10px] tabular-nums mt-0.5">{paymentDue}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="shrink-0">
        <label className="block text-xs text-on-surface-variant mb-1.5">손님 검색</label>
        <NicknameAutocomplete
          id="guest-points-search"
          members={memberSuggestions}
          value={search}
          onChange={setSearch}
          onPick={(m) => setSelectedId(m.id)}
          onEnter={() => {
            const q = search.trim();
            if (!q) return;
            const exact = memberSuggestions.find((m) => m.nickname === q);
            if (exact) setSelectedId(exact.id);
          }}
        />
      </section>

      <div className="flex-1 min-h-0">
        <PointAdjustPanel member={selected} />
      </div>
    </div>
  );
}
