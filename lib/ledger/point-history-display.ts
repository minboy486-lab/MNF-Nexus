import { formatMp, wonToMp } from "@/lib/utils/mp";
import { signedTxnAmount } from "@/lib/ledger/txn-labels";

/** point_earn / point_spend 조정 내역용 */
export function pointAdjustVerb(txnType: string): "충전" | "차감" | null {
  if (txnType === "point_earn") return "충전";
  if (txnType === "point_spend") return "차감";
  return null;
}

export function formatPointHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}. ${get("month")}. ${get("day")}.`;
}

export function formatPointHistoryTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const period = get("dayPeriod");
  const hour = get("hour");
  const minute = get("minute");
  return period ? `${period} ${hour}:${minute}` : `${hour}:${minute}`;
}

export function pointNotificationTitle(txnType: string): string {
  const verb = pointAdjustVerb(txnType);
  if (verb) return `포인트 ${verb}`;
  return "포인트 변동";
}

export function pointNotificationBody(params: {
  txnType: string;
  amountWon: number;
  note?: string | null;
}): string {
  const signed = signedTxnAmount(params.txnType, params.amountWon);
  const absMp = Math.abs(wonToMp(signed));
  const sign = signed >= 0 ? "+" : "−";
  const mpText = `${sign}${Number.isInteger(absMp) ? absMp.toLocaleString("ko-KR") : absMp.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MP`;
  if (params.note?.trim()) return `${mpText} · ${params.note.trim()}`;
  return mpText;
}

export function formatSignedMp(txnType: string, amountWon: number): string {
  const signed = signedTxnAmount(txnType, amountWon);
  const text = formatMp(signed);
  if (signed > 0 && !text.startsWith("+")) return `+${text}`;
  return text;
}
