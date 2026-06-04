"use client";

import { useState } from "react";
import { buildGameStatusShare, copyToClipboard } from "@/lib/kakao/share";

type Props = {
  gameName: string;
  tableCodes: string[];
  level: number;
  blinds: string;
  remaining: string;
  survivors: number;
  entries: number;
  rebuyCount: number;
};

export function KakaoShareButton(props: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const payload = buildGameStatusShare(props);
    const ok = await copyToClipboard(payload.text);
    setCopied(ok);
    if (ok) {
      window.alert("진행 현황이 클립보드에 복사되었습니다. 카카오톡에 붙여넣기 하세요.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="px-4 py-2 rounded-lg border border-yellow-500/40 text-yellow-200 text-sm font-medium hover:bg-yellow-500/10"
    >
      {copied ? "복사됨" : "카카오 공유 (복사)"}
    </button>
  );
}
