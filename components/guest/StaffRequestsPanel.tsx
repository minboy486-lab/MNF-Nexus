"use client";

import { useRouter } from "next/navigation";
import { approveRequest } from "@/lib/actions/games";
import {
  approvePointTransfer,
  rejectPointTransfer,
} from "@/lib/actions/guest";
import type { ApprovalRequest, PointTransferRequest } from "@/lib/types";

type Props = {
  approvals: ApprovalRequest[];
  transfers: PointTransferRequest[];
};

export function StaffRequestsPanel({ approvals, transfers }: Props) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {transfers.length > 0 && (
        <section className="glass-panel rounded-xl p-5 border border-tertiary/30">
          <h2 className="font-bold text-tertiary mb-3">포인트 이체 승인</h2>
          <ul className="space-y-3">
            {transfers.map((t) => {
              const row = t as PointTransferRequest & {
                from_member?: { nickname: string };
                to_member?: { nickname: string };
              };
              return (
              <li key={t.id} className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {row.amount.toLocaleString()}p · {row.from_member?.nickname ?? "?"} →{" "}
                  {row.to_member?.nickname ?? "?"}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await approvePointTransfer(t.id);
                      router.refresh();
                    }}
                    className="text-primary font-bold"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await rejectPointTransfer(t.id);
                      router.refresh();
                    }}
                    className="text-error"
                  >
                    거절
                  </button>
                </span>
              </li>
            );
            })}
          </ul>
        </section>
      )}

      {approvals.length > 0 && (
        <section className="glass-panel rounded-xl p-5 border border-primary/30">
          <h2 className="font-bold text-primary mb-3">손님 요청</h2>
          <ul className="space-y-2">
            {approvals.map((req) => (
              <li
                key={req.id}
                className="flex justify-between items-center text-sm border-b border-white/5 pb-2"
              >
                <span>
                  {req.members?.nickname ?? req.member_id} — {req.request_type}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await approveRequest(req.id);
                    router.refresh();
                  }}
                  className="text-primary font-bold"
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
