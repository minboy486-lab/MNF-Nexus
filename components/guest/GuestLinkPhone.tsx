"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkMemberByPhone } from "@/lib/actions/guest";

export function GuestLinkPhone() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await linkMemberByPhone(phone);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-5 space-y-4">
      <h2 className="font-bold">회원 연동</h2>
      <p className="text-sm text-on-surface-variant">
        매장 접수대에 등록한 전화번호로 계정을 연결합니다.
      </p>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="01012345678"
        className="w-full bg-surface-container-low border border-white/10 rounded-xl py-3 px-4 text-lg"
      />
      {error && <p className="text-error text-sm">{error}</p>}
      <button type="submit" className="w-full bg-primary text-on-primary font-bold py-3 rounded-xl">
        연동하기
      </button>
    </form>
  );
}
