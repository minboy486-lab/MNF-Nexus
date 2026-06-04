"use client";

import { useState } from "react";
import { signIn } from "@/lib/actions/auth";

function FieldIcon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined text-lg text-on-surface-variant/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
      {name}
    </span>
  );
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="login-form-shell">
      <div className="login-form-body">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">로그인</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            계정에 로그인하여 토너먼트를 관리하세요
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-error text-sm bg-error/10 border border-error/30 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <label htmlFor="loginId" className="text-sm text-on-surface-variant">
              아이디
            </label>
            <div className="relative">
              <FieldIcon name="person" />
              <input
                id="loginId"
                name="loginId"
                type="text"
                required
                autoComplete="username"
                placeholder="admin"
                className="login-input w-full pl-11 pr-4"
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_]+"
                title="영문, 숫자, _ (3~32자)"
              />
            </div>
            <p className="text-[11px] text-on-surface-variant/70">
              예: <span className="text-on-surface-variant">admin</span> · 기존{" "}
              <span className="text-on-surface-variant">admin@mnf.com</span> 도 가능
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="password" className="text-sm text-on-surface-variant">
                비밀번호
              </label>
              <button
                type="button"
                className="text-xs text-on-surface-variant/60 hover:text-primary transition-colors"
                tabIndex={-1}
              >
                비밀번호 찾기
              </button>
            </div>
            <div className="relative">
              <FieldIcon name="lock" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                className="login-input w-full pl-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface transition-colors"
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" name="remember" className="login-checkbox" />
            <span className="text-sm text-on-surface-variant">로그인 상태 유지</span>
          </label>

          <button type="submit" disabled={pending} className="btn-primary login-submit w-full mt-1">
            {pending ? "로그인 중..." : "로그인"}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>

          <p className="text-center text-sm text-on-surface-variant pt-2">
            계정이 없으신가요?{" "}
            <span className="text-primary font-semibold">계정 생성하기</span>
          </p>
        </form>
      </div>

      <footer className="login-form-foot">
        <span className="inline-flex items-center gap-2 text-xs text-on-surface-variant/65">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          서버 운영 중
        </span>
        <span className="inline-flex items-center gap-2 text-xs text-on-surface-variant/65">
          <span className="material-symbols-outlined text-sm">shield</span>
          256-bit 보안
        </span>
      </footer>
    </div>
  );
}
