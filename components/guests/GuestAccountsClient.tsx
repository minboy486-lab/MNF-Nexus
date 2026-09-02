"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/AppModal";
import {
  checkGuestLoginIdAvailable,
  checkGuestNicknameAvailable,
  createGuestAccount,
  deleteGuestAccount,
  linkOrphanGuestProfile,
  resetGuestAccountPassword,
  updateGuestAccount,
} from "@/lib/actions/guest-accounts";
import { GUEST_DEFAULT_PASSWORD, type GuestAccountRow } from "@/lib/guest/accounts";
import { formatDateTimeKST } from "@/lib/utils/format";
import { formatMp } from "@/lib/utils/mp";

type Props = {
  accounts: GuestAccountRow[];
  orphans: { id: string; login_id: string; display_name: string | null }[];
  configured: boolean;
  configError?: string;
};

type FormState = {
  login_id: string;
  nickname: string;
  display_name: string;
  phone: string;
};

const emptyForm: FormState = {
  login_id: "",
  nickname: "",
  display_name: "",
  phone: "",
};

export function GuestAccountsClient({
  accounts,
  orphans: initialOrphans,
  configured,
  configError,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [orphans, setOrphans] = useState(initialOrphans);
  const [modal, setModal] = useState<"create" | { edit: GuestAccountRow } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [loginOk, setLoginOk] = useState<boolean | null>(null);
  const [nickOk, setNickOk] = useState<boolean | null>(null);

  const isCreate = modal === "create";
  const editMemberId =
    modal && modal !== "create" ? modal.edit.member_id : undefined;

  const loginInvalid = isCreate && loginOk === false;
  const nickInvalid = nickOk === false;
  const submitDisabled =
    pending || (isCreate ? loginOk !== true || nickOk !== true : nickOk !== true);

  useEffect(() => {
    if (!modal || !isCreate) {
      setLoginOk(null);
      return;
    }
    if (!form.login_id.trim()) {
      setLoginOk(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await checkGuestLoginIdAvailable(form.login_id);
      setLoginOk(res.available ?? false);
    }, 400);
    return () => clearTimeout(t);
  }, [form.login_id, modal, isCreate]);

  useEffect(() => {
    if (!modal) {
      setNickOk(null);
      return;
    }
    if (!form.nickname.trim()) {
      setNickOk(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await checkGuestNicknameAvailable(form.nickname, editMemberId);
      setNickOk(res.available ?? false);
    }, 400);
    return () => clearTimeout(t);
  }, [form.nickname, modal, editMemberId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.login_id.toLowerCase().includes(q) ||
        a.nickname.toLowerCase().includes(q) ||
        (a.display_name?.toLowerCase().includes(q) ?? false),
    );
  }, [accounts, search]);

  function openCreate() {
    setForm(emptyForm);
    setLoginOk(null);
    setNickOk(null);
    setModal("create");
  }

  function openEdit(row: GuestAccountRow) {
    setForm({
      login_id: row.login_id,
      nickname: row.nickname,
      display_name: row.display_name ?? "",
      phone: row.phone ?? "",
    });
    setLoginOk(null);
    setNickOk(null);
    setModal({ edit: row });
  }

  function closeModal() {
    setModal(null);
    setForm(emptyForm);
    setLoginOk(null);
    setNickOk(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await createGuestAccount({
      login_id: form.login_id,
      nickname: form.nickname,
      display_name: form.display_name || undefined,
      phone: form.phone || undefined,
    });
    setPending(false);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    closeModal();
    router.refresh();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || modal === "create") return;
    setPending(true);
    const result = await updateGuestAccount({
      member_id: modal.edit.member_id,
      nickname: form.nickname,
      display_name: form.display_name || undefined,
      phone: form.phone || undefined,
    });
    setPending(false);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    closeModal();
    router.refresh();
  }

  async function handleResetPassword(row: GuestAccountRow) {
    if (
      !confirm(
        `비밀번호를 초기값(${GUEST_DEFAULT_PASSWORD})으로 재설정할까요?\n아이디: ${row.login_id}`,
      )
    ) {
      return;
    }
    setPending(true);
    const result = await resetGuestAccountPassword(row.member_id);
    setPending(false);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    alert(`비밀번호를 ${GUEST_DEFAULT_PASSWORD}(으)로 재설정했습니다.`);
    router.refresh();
  }

  async function handleDelete(row: GuestAccountRow) {
    if (
      !confirm(
        `손님 계정을 삭제할까요?\n아이디: ${row.login_id} · ${row.nickname}\n(로그인 계정도 함께 삭제됩니다)`,
      )
    ) {
      return;
    }
    setPending(true);
    const result = await deleteGuestAccount(row.member_id);
    setPending(false);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleLinkOrphan(profileId: string, loginId: string) {
    if (!confirm(`기존 손님 계정을 이 지점에 연동할까요?\n아이디: ${loginId}`)) return;
    setPending(true);
    const result = await linkOrphanGuestProfile(profileId);
    setPending(false);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    setOrphans((prev) => prev.filter((p) => p.id !== profileId));
    router.refresh();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {!configured && (
        <div className="app-panel-solid rounded-2xl p-4 text-sm">
          <p className="font-semibold text-tertiary mb-1.5">계정 API 미설정</p>
          <p className="text-on-surface-variant">{configError ?? "SUPABASE_SERVICE_ROLE_KEY가 필요합니다."}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="아이디·닉네임 검색"
          className="login-input flex-1 min-w-[12rem] text-sm py-2"
        />
        <button
          type="button"
          disabled={!configured || pending}
          onClick={openCreate}
          className="btn-primary h-10 px-5 rounded-xl text-sm disabled:opacity-50 inline-flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          손님 계정 생성
        </button>
      </div>

      <p className="text-xs text-on-surface-variant -mt-2">
        초기 비밀번호는 <strong className="text-on-surface">{GUEST_DEFAULT_PASSWORD}</strong>입니다.
        손님은 앱에서 비밀번호를 변경할 수 있습니다.
      </p>

      <div className="app-panel-solid rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#181a24] text-on-surface-variant text-[11px] uppercase tracking-wider">
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3.5 font-semibold">아이디</th>
                <th className="text-left px-5 py-3.5 font-semibold">닉네임</th>
                <th className="text-left px-5 py-3.5 font-semibold hidden sm:table-cell">MP</th>
                <th className="text-left px-5 py-3.5 font-semibold hidden md:table-cell">최근 로그인</th>
                <th className="text-right px-5 py-3.5 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.member_id}
                  className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-xs sm:text-sm">{row.login_id}</td>
                  <td className="px-5 py-3.5">
                    <div>{row.nickname}</div>
                    {row.display_name && row.display_name !== row.nickname && (
                      <div className="text-xs text-on-surface-variant">{row.display_name}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell tabular-nums text-primary font-semibold">
                    {formatMp(row.point_balance)}
                  </td>
                  <td className="px-5 py-3.5 text-on-surface-variant text-xs hidden md:table-cell">
                    {row.last_sign_in_at ? formatDateTimeKST(row.last_sign_in_at) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                      <button
                        type="button"
                        disabled={!configured || pending}
                        onClick={() => openEdit(row)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
                      >
                        수정
                      </button>
                      {row.user_id && (
                        <button
                          type="button"
                          disabled={!configured || pending}
                          onClick={() => handleResetPassword(row)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium text-on-surface-variant hover:bg-white/10 disabled:opacity-50"
                        >
                          비번 초기화
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!configured || pending}
                        onClick={() => handleDelete(row)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-error hover:bg-error/15 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-on-surface-variant">
                    등록된 손님 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {orphans.length > 0 && (
        <section className="glass-panel rounded-xl p-4 border border-tertiary/30 shrink-0">
          <h2 className="font-bold text-sm text-tertiary mb-2">기존 손님 계정 연동</h2>
          <p className="text-xs text-on-surface-variant mb-3">
            계정 관리에서 만들었던 손님 계정을 현재 지점에 연결합니다.
          </p>
          <ul className="space-y-2">
            {orphans.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 text-sm border border-white/10 rounded-lg px-3 py-2"
              >
                <span>
                  <span className="font-mono text-xs">{p.login_id}</span>
                  {p.display_name && (
                    <span className="text-on-surface-variant ml-2">{p.display_name}</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={!configured || pending}
                  onClick={() => handleLinkOrphan(p.id, p.login_id)}
                  className="text-primary text-xs font-bold hover:underline disabled:opacity-50 shrink-0"
                >
                  이 지점에 연동
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modal && (
        <AppModal
          onClose={closeModal}
          title={modal === "create" ? "손님 계정 생성" : "손님 정보 수정"}
          subtitle={modal !== "create" ? `@${modal.edit.login_id}` : undefined}
          accent="primary"
          maxWidth="md"
          footer={
            <>
              <button type="button" onClick={closeModal} className="app-modal-btn-secondary">
                취소
              </button>
              <button
                type="submit"
                form="guest-account-form"
                disabled={submitDisabled}
                className="flex-1 h-11 rounded-xl text-sm font-bold btn-primary disabled:opacity-50"
              >
                {pending ? "처리 중…" : modal === "create" ? "생성" : "저장"}
              </button>
            </>
          }
        >
          <form
            id="guest-account-form"
            onSubmit={modal === "create" ? handleCreate : handleUpdate}
            autoComplete="off"
            className="space-y-4 pb-1"
          >
            {modal === "create" && (
              <label>
                <span className="app-modal-label">아이디</span>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  className={`app-modal-field ${loginInvalid ? "!border-error" : ""}`}
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9_]+"
                  value={form.login_id}
                  onChange={(e) => setForm((f) => ({ ...f, login_id: e.target.value.toLowerCase() }))}
                />
                {loginInvalid && (
                  <span className="app-modal-hint-error mt-1 block">이미 사용 중인 아이디</span>
                )}
                {loginOk === true && (
                  <span className="app-modal-hint-ok mt-1 block">사용 가능</span>
                )}
                <p className="text-[10px] text-on-surface-variant/70 mt-1">
                  영문 소문자·숫자·_ (3~32자, 전 지점 중복 불가)
                </p>
              </label>
            )}

            <label>
              <span className="app-modal-label">닉네임</span>
              <input
                type="text"
                required
                className={`app-modal-field ${nickInvalid ? "!border-error" : ""}`}
                value={form.nickname}
                onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
              />
              {nickInvalid && (
                <span className="app-modal-hint-error mt-1 block">이 지점에서 이미 사용 중인 닉네임</span>
              )}
              {nickOk === true && (
                <span className="app-modal-hint-ok mt-1 block">사용 가능</span>
              )}
              <p className="text-[10px] text-on-surface-variant/70 mt-1">
                같은 지점 내 중복 불가 (다른 지점은 가능)
              </p>
            </label>

            <label>
              <span className="app-modal-label">표시 이름 (선택)</span>
              <input
                type="text"
                className="app-modal-field"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </label>

            <label>
              <span className="app-modal-label">전화번호 (선택)</span>
              <input
                type="tel"
                className="app-modal-field"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>

            {modal === "create" && (
              <p className="text-xs text-on-surface-variant rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                초기 비밀번호: <strong className="text-on-surface">{GUEST_DEFAULT_PASSWORD}</strong>
              </p>
            )}
          </form>
        </AppModal>
      )}
    </div>
  );
}
