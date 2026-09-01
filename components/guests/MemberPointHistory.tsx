"use client";

import { useEffect, useState } from "react";
import { fetchMemberPointHistory, type MemberPointHistoryRow } from "@/lib/actions/points";
import { signedTxnAmount, txnTypeLabel } from "@/lib/ledger/txn-labels";
import { formatMp } from "@/lib/utils/mp";

type Props = {
  memberId: string;
  refreshKey?: number;
};

function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MemberPointHistory({ memberId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<MemberPointHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchMemberPointHistory(memberId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        setRows([]);
      } else {
        setRows(result.rows);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [memberId, refreshKey]);

  return (
    <section className="glass-panel rounded-xl border border-white/10 p-4">
      <header className="mb-3">
        <h2 className="font-bold text-base">최근 내역</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">최대 30건</p>
      </header>

      {loading ? (
        <p className="text-on-surface-variant text-sm text-center py-8">불러오는 중…</p>
      ) : error ? (
        <p className="text-error text-sm text-center py-8">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-on-surface-variant text-sm text-center py-8">내역이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const signed = signedTxnAmount(row.txn_type, row.amount);
            return (
              <li
                key={row.id}
                className="rounded-xl px-4 py-3 flex justify-between gap-4 text-sm bg-white/[0.04] border border-white/10"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-on-surface">{txnTypeLabel(row.txn_type)}</span>
                  {row.note && (
                    <p className="text-xs text-on-surface-variant mt-1 truncate">{row.note}</p>
                  )}
                  <p className="text-xs text-on-surface-variant/80 mt-1 tabular-nums">
                    {formatOccurredAt(row.occurred_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 tabular-nums font-bold text-base self-center ${signed >= 0 ? "text-primary" : "text-error"}`}
                >
                  {signed >= 0 ? "+" : ""}
                  {formatMp(signed)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
