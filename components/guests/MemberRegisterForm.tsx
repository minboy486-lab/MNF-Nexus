"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/AppModal";
import {
  checkNicknameAvailable,
  checkLoginIdAvailable,
  createMember,
} from "@/lib/actions/members";

type FormProps = {
  onSuccess?: () => void;
};

export function MemberRegisterForm({ onSuccess }: FormProps) {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [nickOk, setNickOk] = useState<boolean | null>(null);
  const [loginOk, setLoginOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!nickname.trim()) {
      setNickOk(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await checkNicknameAvailable(nickname);
      setNickOk(res.available ?? false);
    }, 400);
    return () => clearTimeout(t);
  }, [nickname]);

  useEffect(() => {
    if (!loginId.trim()) {
      setLoginOk(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await checkLoginIdAvailable(loginId);
      setLoginOk(res.available ?? false);
    }, 400);
    return () => clearTimeout(t);
  }, [loginId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await createMember({
      loginId,
      password,
      nickname,
      displayName: displayName || undefined,
      phone: phone || undefined,
    });
    setPending(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setLoginId("");
    setPassword("");
    setNickname("");
    setDisplayName("");
    setPhone("");
    setNickOk(null);
    setLoginOk(null);
    router.refresh();
    onSuccess?.();
  }

  const nickInvalid = nickOk === false;
  const loginInvalid = loginOk === false;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-5 sm:pb-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <label>
          <span className="app-modal-label">
            아이디 <span className="required">*</span>
          </span>
          <input
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className={`app-modal-field ${loginInvalid ? "!border-error" : ""}`}
            autoComplete="off"
            required
          />
          {loginInvalid && (
            <span className="app-modal-hint-error mt-1 block">이미 사용 중인 아이디</span>
          )}
          {loginOk === true && (
            <span className="app-modal-hint-ok mt-1 block">사용 가능</span>
          )}
        </label>

        <label>
          <span className="app-modal-label">
            비밀번호 <span className="required">*</span>
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="app-modal-field"
            autoComplete="new-password"
            required
            minLength={4}
          />
        </label>

        <label>
          <span className="app-modal-label">
            닉네임 <span className="required">*</span>
          </span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={`app-modal-field ${nickInvalid ? "!border-error" : ""}`}
            autoComplete="off"
            required
          />
          {nickInvalid && (
            <span className="app-modal-hint-error mt-1 block">이미 사용 중인 닉네임</span>
          )}
          {nickOk === true && (
            <span className="app-modal-hint-ok mt-1 block">사용 가능</span>
          )}
        </label>

        <label>
          <span className="app-modal-label">이름</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="app-modal-field"
            autoComplete="name"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="app-modal-label">전화번호</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="app-modal-field"
            inputMode="tel"
            autoComplete="tel"
            placeholder="선택 (10자리 이상)"
          />
        </label>
      </div>

      {error && (
        <p className="text-error text-sm bg-error/10 border border-error/30 rounded-xl px-3 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || nickInvalid || loginInvalid || nickOk !== true || loginOk !== true}
        className="btn-primary w-full h-11 rounded-xl text-sm font-bold disabled:opacity-40"
      >
        {pending ? "등록 중..." : "손님 등록"}
      </button>
    </form>
  );
}

export function MemberRegisterModal({ onClose }: { onClose: () => void }) {
  return (
    <AppModal
      onClose={onClose}
      title="손님 등록"
      subtitle="매장에서 미리 등록해 두고, 목록에서 방문 중으로 옮깁니다."
      accent="tertiary"
      maxWidth="lg"
      titleId="member-register-title"
    >
      <MemberRegisterForm onSuccess={onClose} />
    </AppModal>
  );
}
