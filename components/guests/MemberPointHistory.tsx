"use client";

import { useEffect, useState } from "react";
import { fetchMemberPointHistory, type MemberPointHistoryRow } from "@/lib/actions/points";
import { PointHistoryRow } from "@/components/ledger/PointHistoryRow";

type Props = {
  memberId: string;
  refreshKey?: number;
};

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
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <PointHistoryRow
              key={row.id}
              txnType={row.txn_type}
              amount={row.amount}
              occurredAt={row.occurred_at}
              note={row.note}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
