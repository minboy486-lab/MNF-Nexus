"use client";

import { useState } from "react";
import { requestReservation } from "@/lib/actions/guest";

export default function GuestReservePage() {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await requestReservation(message);
    if ("error" in res && res.error) setFeedback(res.error);
    else {
      setFeedback("예약 요청이 접수되었습니다. 매장에서 확인 후 연락드립니다.");
      setMessage("");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">방문 예약</h1>
      <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-5 space-y-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="희망 날짜·시간·인원 등"
          rows={4}
          className="w-full bg-surface-container-low border border-white/10 rounded-xl py-3 px-4"
        />
        {feedback && <p className="text-sm text-primary">{feedback}</p>}
        <button type="submit" className="w-full bg-primary text-on-primary font-bold py-3 rounded-xl">
          예약 요청
        </button>
      </form>
    </div>
  );
}
