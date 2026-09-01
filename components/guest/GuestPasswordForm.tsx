"use client";

import { useState } from "react";
import { changeGuestPassword } from "@/lib/actions/guest-settings";

export function GuestPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setPending(true);
    const result = await changeGuestPassword({ currentPassword, newPassword });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess("비밀번호를 변경했습니다.");
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
      <h1 className="text-lg font-bold">비밀번호 변경</h1>

      <label className="block text-sm">
        <span className="text-on-surface-variant">현재 비밀번호</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          className="login-input w-full mt-1"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={pending}
        />
      </label>

      <label className="block text-sm">
        <span className="text-on-surface-variant">새 비밀번호</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="login-input w-full mt-1"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={pending}
        />
      </label>

      <label className="block text-sm">
        <span className="text-on-surface-variant">새 비밀번호 확인</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="login-input w-full mt-1"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={pending}
        />
      </label>

      {error && <p className="text-error text-sm">{error}</p>}
      {success && <p className="text-primary text-sm">{success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full py-3 rounded-xl font-bold disabled:opacity-50"
      >
        {pending ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}
