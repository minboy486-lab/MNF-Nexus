"use client";

import { useState } from "react";

type Props = {
  memberNames: string[];
  seatNumbers: number[];
};

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function EventsWheelClient({ memberNames, seatNumbers }: Props) {
  const [pool, setPool] = useState<"members" | "seats">("members");
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  function spin() {
    setSpinning(true);
    setResult(null);
    const items = pool === "members" ? memberNames : seatNumbers.map((n) => `Seat ${n}`);
    let ticks = 0;
    const interval = setInterval(() => {
      setResult(pickRandom(items) ?? "—");
      ticks += 1;
      if (ticks > 12) {
        clearInterval(interval);
        setSpinning(false);
      }
    }, 80);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPool("members")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${
            pool === "members" ? "bg-primary/20 border border-primary text-primary" : "border border-white/10"
          }`}
        >
          회원 풀
        </button>
        <button
          type="button"
          onClick={() => setPool("seats")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${
            pool === "seats" ? "bg-primary/20 border border-primary text-primary" : "border border-white/10"
          }`}
        >
          Seat 풀
        </button>
      </div>

      <div className="glass-panel rounded-3xl aspect-square flex flex-col items-center justify-center p-8 border-2 border-primary/30">
        <p className="text-xs text-on-surface-variant mb-4">MNF 돌림판</p>
        <p className="text-4xl font-black text-primary text-center min-h-[3rem]">
          {result ?? "?"}
        </p>
      </div>

      <button
        type="button"
        disabled={spinning}
        onClick={spin}
        className="btn-primary w-full py-4 rounded-xl text-lg"
      >
        {spinning ? "돌리는 중..." : "돌리기"}
      </button>

      <p className="text-xs text-on-surface-variant text-center">
        빙고판 등 추가 이벤트는 후속 업데이트 예정
      </p>
    </div>
  );
}
