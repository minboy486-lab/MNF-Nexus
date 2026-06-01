"use client";

import { useRouter } from "next/navigation";
import type { ApprovalRequest, MemberVisitWithMember } from "@/lib/types";
import { checkOutVisit } from "@/lib/actions/members";
import { formatChips } from "@/lib/utils/format";

type Props = {
  visits: MemberVisitWithMember[];
  pending: ApprovalRequest[];
  approveAction: (requestId: string) => Promise<void>;
};

export function GuestsClient({ visits, pending, approveAction }: Props) {
  const router = useRouter();

  async function handleLeave(visitId: string) {
    const res = await checkOutVisit(visitId);
    if (res.error) alert(res.error);
    router.refresh();
  }

  async function handleApprove(id: string) {
    await approveAction(id);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-primary rounded-full" />
          방문 중 ({visits.length})
        </h2>
        <p className="text-sm text-on-surface-variant mb-4">
          접수대에서 전화 조회 시 자동 등록됩니다. 퇴장 시 「나감」을 눌러 주세요.
        </p>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visits.map((v) => {
            const m = v.members;
            return (
              <li
                key={v.id}
                className="glass-panel rounded-lg px-4 py-3 flex flex-col gap-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-lg">{m?.nickname}</span>
                    {m?.phone && (
                      <p className="text-xs text-on-surface-variant">{m.phone}</p>
                    )}
                  </div>
                  {m && m.credit_balance < 0 && (
                    <span className="text-error text-sm font-bold tabular-nums">
                      {formatChips(m.credit_balance)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant">
                  입장 {new Date(v.checked_in_at).toLocaleTimeString("ko-KR")}
                </p>
                <button
                  type="button"
                  onClick={() => handleLeave(v.id)}
                  className="text-sm border border-outline-variant rounded-lg py-2 hover:border-error/50 hover:text-error"
                >
                  나감
                </button>
              </li>
            );
          })}
        </ul>
        {visits.length === 0 && (
          <p className="text-on-surface-variant text-sm">방문 중인 손님이 없습니다.</p>
        )}
      </section>

      {pending.length > 0 && (
        <section className="glass-panel rounded-xl p-5 border border-primary/30">
          <h2 className="font-bold text-primary mb-3">승인 대기</h2>
          <ul className="space-y-2">
            {pending.map((req) => (
              <li
                key={req.id}
                className="flex justify-between items-center text-sm border-b border-outline-variant/20 pb-2"
              >
                <span>
                  {req.members?.nickname ?? req.member_id} — {req.request_type}
                  {req.seat_number ? ` · 좌석 ${req.seat_number}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => handleApprove(req.id)}
                  className="text-primary font-bold hover:underline"
                >
                  승인
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
