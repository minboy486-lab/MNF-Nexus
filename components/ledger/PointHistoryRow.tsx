import {
  pointAdjustVerb,
  formatPointHistoryDate,
  formatPointHistoryTime,
  formatSignedMp,
} from "@/lib/ledger/point-history-display";
import { txnTypeLabel } from "@/lib/ledger/txn-labels";

type Props = {
  txnType: string;
  amount: number;
  occurredAt: string;
  note?: string | null;
};

export function PointHistoryRow({ txnType, amount, occurredAt, note }: Props) {
  const verb = pointAdjustVerb(txnType);
  const signed = formatSignedMp(txnType, amount);

  return (
    <li className="rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-sm bg-white/[0.04] border border-white/10">
      <div className="shrink-0 text-[11px] text-on-surface-variant tabular-nums leading-snug min-w-[4.75rem]">
        <span className="block">{formatPointHistoryDate(occurredAt)}</span>
        <span className="block mt-0.5">{formatPointHistoryTime(occurredAt)}</span>
      </div>
      <p className="min-w-0 flex-1 truncate text-on-surface">
        {verb ? (
          <>
            포인트 <span className="text-error font-semibold">{verb}</span>
          </>
        ) : (
          <span className="font-medium">{txnTypeLabel(txnType)}</span>
        )}
        {note?.trim() && (
          <span className="text-on-surface-variant ml-1.5 truncate">· {note.trim()}</span>
        )}
      </p>
      <span
        className={`shrink-0 tabular-nums font-bold ${signed.startsWith("+") ? "text-primary" : "text-error"}`}
      >
        {signed}
      </span>
    </li>
  );
}
