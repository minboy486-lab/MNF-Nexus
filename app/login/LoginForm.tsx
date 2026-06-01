"use client";

import { useState } from "react";
import { signIn } from "@/lib/actions/auth";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">로그인</h2>
        <p className="text-on-surface-variant text-sm font-medium">관리자·직원 계정</p>
      </div>
      {error && (
        <p className="text-error text-sm bg-error/10 border border-error/30 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-[0.15em]" htmlFor="email">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 backdrop-blur-sm transition-colors"
          placeholder="admin@mnf.com"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-[0.15em]" htmlFor="password">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 backdrop-blur-sm transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_0_24px_rgba(255,22,240,0.2)] hover:brightness-110 transition-all"
      >
        {pending ? "로그인 중..." : "로그인"}
        <span className="material-symbols-outlined">arrow_forward</span>
      </button>
    </form>
  );
}
