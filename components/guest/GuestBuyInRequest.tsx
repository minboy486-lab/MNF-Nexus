"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestBuyIn } from "@/lib/actions/guest";

type GameRow = {
  id: string;
  daily_game_number?: number | null;
  game_presets?: { name: string } | { name: string }[] | null;
};

function presetName(g: GameRow) {
  const p = g.game_presets;
  if (!p) return "";
  if (Array.isArray(p)) return p[0]?.name ?? "";
  return p.name;
}

export function GuestBuyInRequest({ games }: { games: GameRow[] }) {
  const router = useRouter();
  const [gameId, setGameId] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gameId) return;
    const res = await requestBuyIn(gameId, note);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("바이인 요청이 접수되었습니다. 매장 확인 후 반영됩니다.");
      setGameId("");
      setNote("");
    }
    router.refresh();
  }

  if (games.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-4 space-y-3">
      <h2 className="font-bold text-sm">바이인 요청</h2>
      <select
        value={gameId}
        onChange={(e) => setGameId(e.target.value)}
        className="w-full bg-surface-container-low border border-white/10 rounded-lg py-3 px-3"
      >
        <option value="">게임 선택</option>
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            #{g.daily_game_number ?? "—"} {presetName(g)}
          </option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="메모 (선택)"
        className="w-full bg-surface-container-low border border-white/10 rounded-lg py-2 px-3 text-sm"
      />
      {msg && <p className="text-sm text-primary">{msg}</p>}
      <button type="submit" className="w-full bg-primary text-on-primary font-bold py-3 rounded-xl">
        요청 보내기
      </button>
    </form>
  );
}
