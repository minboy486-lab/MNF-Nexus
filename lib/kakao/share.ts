import { formatMp } from "@/lib/utils/mp";

export type KakaoSharePayload = {
  title: string;
  description: string;
  text: string;
};

export function buildGameStatusShare(params: {
  gameName: string;
  tableCodes: string[];
  level: number;
  blinds: string;
  remaining: string;
  survivors: number;
  entries: number;
  rebuyCount: number;
}): KakaoSharePayload {
  const text = [
    `[MNF] ${params.gameName}`,
    `테이블: ${params.tableCodes.join(" · ")}`,
    `Level ${params.level} | ${params.blinds}`,
    `남은 시간: ${params.remaining}`,
    `생존 ${params.survivors} / 엔트리 ${params.entries} | 리바인 ${params.rebuyCount}`,
  ].join("\n");

  return {
    title: "MNF 진행 현황",
    description: params.gameName,
    text,
  };
}

export function buildMoneyInShare(params: {
  sessionDate: string;
  games: { label: string; buyIn: number }[];
  totalBuyIn: number;
}): KakaoSharePayload {
  const lines = params.games.map((g) => `${g.label}: ${formatMp(g.buyIn)}`);
  const text = [
    `[MNF] 투데이 머니인 ${params.sessionDate}`,
    ...lines,
    `합계: ${formatMp(params.totalBuyIn)}`,
  ].join("\n");

  return {
    title: "MNF 투데이 머니인",
    description: params.sessionDate,
    text,
  };
}

export async function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}
