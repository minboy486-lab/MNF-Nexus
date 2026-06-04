"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/AppModal";
import {
  createAccount,
  deleteAccount,
  updateAccount,
  type AccountRow,
} from "@/lib/actions/accounts";
import { PROFILE_ROLE_LABELS, PROFILE_ROLES } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";
import { formatDateTimeKST } from "@/lib/utils/format";

type Props = {
  accounts: AccountRow[];
  configured: boolean;
  configError?: string;
};

type FormState = {
  login_id: string;
  password: string;
  display_name: string;
  role: UserRole;
};

const emptyForm: FormState = {
  login_id: "",
  password: "",
  display_name: "",
  role: "staff",
};

function AccountFormModal({
  mode,
  editLoginId,
  form,
  newPassword,
  pending,
  roleOptions,
  onClose,
  onSubmit,
  onFormChange,
  onNewPasswordChange,
}: {
  mode: "create" | "edit";
  editLoginId?: string;
  form: FormState;
  newPassword: string;
  pending: boolean;
  roleOptions: { value: UserRole; label: string }[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormChange: (patch: Partial<FormState>) => void;
  onNewPasswordChange: (v: string) => void;
}) {
  return (
    <AppModal
      onClose={onClose}
      title={mode === "create" ? "계정 생성" : "계정 수정"}
      subtitle={mode === "edit" && editLoginId ? `@${editLoginId}` : undefined}
      accent="tertiary"
      maxWidth="md"
      titleId="account-modal-title"
      footer={
        <>
          <button type="button" onClick={onClose} className="app-modal-btn-secondary">
            취소
          </button>
          <button
            type="submit"
            form="account-form"
            disabled={pending}
            className="flex-1 h-11 rounded-xl text-sm font-bold btn-primary disabled:opacity-50"
          >
            {pending ? "처리 중…" : mode === "create" ? "계정 생성" : "저장"}
          </button>
        </>
      }
    >
      <form
        id="account-form"
        onSubmit={onSubmit}
        autoComplete="off"
        className="space-y-5 pb-1"
      >
          {mode === "create" && (
            <label>
              <span className="app-modal-label">아이디</span>
              <input
                type="text"
                required
                autoComplete="off"
                placeholder="staff01"
                className="app-modal-field"
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_]+"
                value={form.login_id}
                onChange={(e) =>
                  onFormChange({ login_id: e.target.value.toLowerCase() })
                }
              />
              <p className="text-[10px] text-on-surface-variant/70 mt-1">
                영문 소문자·숫자·_ (3~32자)
              </p>
            </label>
          )}

        <label>
          <span className="app-modal-label">표시 이름</span>
          <input
            type="text"
            autoComplete="nickname"
            placeholder="카운터 · 홍길동"
            className="app-modal-field"
            value={form.display_name}
            onChange={(e) => onFormChange({ display_name: e.target.value })}
          />
        </label>

        <fieldset className="space-y-2.5">
          <legend className="app-modal-label">권한</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {roleOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                data-active={form.role === o.value}
                className="app-role-chip"
                onClick={() => onFormChange({ role: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label>
          <span className="app-modal-label">
            {mode === "create" ? "비밀번호" : "새 비밀번호"}
            {mode === "edit" && (
              <span className="font-normal text-on-surface-variant/70 ml-1">
                (변경 시만)
              </span>
            )}
          </span>
          <input
            type="password"
            autoComplete={mode === "create" ? "new-password" : "off"}
            placeholder={mode === "create" ? "6자 이상" : "비워두면 유지"}
            className="app-modal-field"
            minLength={mode === "create" ? 6 : undefined}
            required={mode === "create"}
            value={mode === "create" ? form.password : newPassword}
            onChange={(e) =>
              mode === "create"
                ? onFormChange({ password: e.target.value })
                : onNewPasswordChange(e.target.value)
            }
          />
        </label>
      </form>
    </AppModal>
  );
}

export function AccountsClient({ accounts, configured, configError }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [modal, setModal] = useState<"create" | { edit: AccountRow } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newPassword, setNewPassword] = useState("");

  const roleOptions = useMemo(
    () =>
      PROFILE_ROLES.map((r) => ({
        value: r,
        label: PROFILE_ROLE_LABELS[r],
      })),
    [],
  );

  function openCreate() {
    setForm(emptyForm);
    setNewPassword("");
    setModal("create");
  }

  function openEdit(row: AccountRow) {
    setForm({
      login_id: row.login_id,
      password: "",
      display_name: row.display_name ?? "",
      role: row.role === "counter" ? "screen" : row.role,
    });
    setNewPassword("");
    setModal({ edit: row });
  }

  function closeModal() {
    setModal(null);
    setForm(emptyForm);
    setNewPassword("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await createAccount({
      login_id: form.login_id,
      password: form.password,
      display_name: form.display_name,
      role: form.role,
    });
    setPending(false);
    if ("error" in result && result.error) {
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
    const result = await updateAccount({
      userId: modal.edit.id,
      role: form.role,
      display_name: form.display_name,
      password: newPassword || undefined,
    });
    setPending(false);
    if ("error" in result && result.error) {
      alert(result.error);
      return;
    }
    closeModal();
    router.refresh();
  }

  async function handleDelete(row: AccountRow) {
    if (!confirm(`계정을 삭제할까요?\n아이디: ${row.login_id}`)) return;
    setPending(true);
    const result = await deleteAccount(row.id);
    setPending(false);
    if ("error" in result && result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 sm:p-6 gap-5">
      {!configured && (
        <div className="app-panel-solid rounded-2xl p-4 sm:p-5 text-sm">
          <p className="font-semibold text-tertiary mb-1.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">warning</span>
            계정 API 미설정
          </p>
          <p className="text-on-surface-variant leading-relaxed space-y-2">
            {configError ? (
              <span>{configError}</span>
            ) : (
              <>
                <span>
                  서버가 <code className="text-primary">SUPABASE_SERVICE_ROLE_KEY</code>를
                  아직 읽지 못했습니다.
                </span>
                <span className="block">
                  .env.local에 넣었다면 <strong className="text-on-surface">터미널에서 dev
                  서버를 완전히 종료(Ctrl+C)</strong>한 뒤{" "}
                  <code className="text-primary">npm run dev</code>로 다시 시작하세요. (저장만
                  하면 반영되지 않습니다.)
                </span>
                <span className="block text-xs opacity-80">
                  Vercel 등 배포 환경에서는 프로젝트 Environment Variables에도 동일 키를
                  등록해야 합니다.
                </span>
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-on-surface-variant">
            로그인 계정 <span className="text-on-surface font-semibold">{accounts.length}</span>개
          </p>
          <p className="text-xs text-on-surface-variant/80 mt-0.5">
            관리자 · 매니저 · 직원 · 손님 · 스크린
          </p>
        </div>
        <button
          type="button"
          disabled={!configured || pending}
          onClick={openCreate}
          className="btn-primary h-10 px-5 rounded-xl text-sm disabled:opacity-50 inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          계정 생성
        </button>
      </div>

        <div className="app-panel-solid rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#181a24] text-on-surface-variant text-[11px] uppercase tracking-wider">
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3.5 font-semibold">아이디</th>
                <th className="text-left px-5 py-3.5 font-semibold">표시 이름</th>
                <th className="text-left px-5 py-3.5 font-semibold">권한</th>
                <th className="text-left px-5 py-3.5 font-semibold hidden lg:table-cell">
                  최근 로그인
                </th>
                <th className="text-right px-5 py-3.5 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-xs sm:text-sm text-on-surface/90">
                    {row.login_id}
                  </td>
                  <td className="px-5 py-3.5">{row.display_name ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/12 text-primary border border-primary/20">
                      {PROFILE_ROLE_LABELS[row.role === "counter" ? "screen" : row.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-on-surface-variant text-xs hidden lg:table-cell">
                    {row.last_sign_in_at ? formatDateTimeKST(row.last_sign_in_at) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                      <button
                        type="button"
                        disabled={!configured || pending}
                        onClick={() => openEdit(row)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50 transition-colors"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        disabled={!configured || pending}
                        onClick={() => handleDelete(row)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-error hover:bg-error/15 disabled:opacity-50 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl opacity-30 block mb-2">
                      group_off
                    </span>
                    등록된 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <AccountFormModal
          mode={modal === "create" ? "create" : "edit"}
          editLoginId={modal !== "create" ? modal.edit.login_id : undefined}
          form={form}
          newPassword={newPassword}
          pending={pending}
          roleOptions={roleOptions}
          onClose={closeModal}
          onSubmit={modal === "create" ? handleCreate : handleUpdate}
          onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onNewPasswordChange={setNewPassword}
        />
      )}
    </div>
  );
}
