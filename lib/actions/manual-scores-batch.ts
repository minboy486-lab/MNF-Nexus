"use server";

import { revalidatePath } from "next/cache";
import type { AddManualScoreInput } from "@/lib/actions/manual-scores";
import { addManualScore } from "@/lib/actions/manual-scores";

export async function addManualScoresBatch(rows: AddManualScoreInput[]) {
  let saved = 0;
  let lastNickname = "";
  let anyMemberCreated = false;

  for (const row of rows) {
    const nick = row.nickname.trim();
    const buyIn = Math.round(row.buyInPoints || 0);
    const rebuy = Math.round(row.rebuyPoints || 0);
    const moneyIn = Math.round(row.moneyInPoints || 0);
    if (!nick || buyIn + rebuy + moneyIn === 0) continue;

    const result = await addManualScore(row);
    if ("error" in result && result.error) {
      return { error: `${lastNickname ? `${lastNickname} 다음 — ` : ""}${result.error}`, saved };
    }
    saved += 1;
    lastNickname = result.nickname;
    if (result.memberCreated) anyMemberCreated = true;
  }

  if (saved === 0) return { error: "저장할 행이 없습니다. 닉네임과 점수를 입력하세요." };

  revalidatePath("/admin/scores");
  return { success: true, saved, anyMemberCreated };
}
