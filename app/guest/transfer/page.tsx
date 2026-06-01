"use client";

import { useState } from "react";
import { requestPointTransfer } from "@/lib/actions/guest";

export default function GuestTransferPage() {
  const [toPhone, setToPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await requestPointTransfer(toPhone, Number(amount), message);
    if ("error" in res && res.error) setFeedback(res.error);
    else {
      setFeedback("이체 요청이 접수되었습니다. 매장 승인 후 반영됩니다.");
      setToPhone("");
      setAmount("");
      setMessage("");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">포인트 이체</h1>
      <p className="text-sm text-on-surface-variant">
        받는 분도 MNF 회원이어야 합니다. 매장 확인 후 이체됩니다.
      </p>
      <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-5 space-y-4">
        <input
          type="tel"
          value={toPhone}
          onChange={(e) => setToPhone(e.target.value)}
          placeholder="받는 분 전화번호"
          className="w-full bg-surface-container-low border border-white/10 rounded-xl py-3 px-4"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="포인트"
          className="w-full bg-surface-container-low border border-white/10 rounded-xl py-3 px-4"
        />
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메모 (선택)"
          className="w-full bg-surface-container-low border border-white/10 rounded-lg py-2 px-3"
        />
        {feedback && <p className="text-sm text-primary">{feedback}</p>}
        <button type="submit" className="w-full bg-primary text-on-primary font-bold py-3 rounded-xl">
          이체 요청
        </button>
      </form>
    </div>
  );
}
