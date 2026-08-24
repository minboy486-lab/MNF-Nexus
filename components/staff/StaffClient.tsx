"use client";

import { formatMp } from "@/lib/utils/mp";
import { formatTimeHHmmKST } from "@/lib/utils/format";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/AppModal";
import {
  createStaffAccount,
  staffCheckIn,
  staffCheckOut,
  recordStaffAdvance,
  type StaffListRow,
} from "@/lib/actions/staff";

type PayrollLine = {
  staffId: string;
  name: string;
  hours: number;
  gross: number;
  advances: number;
  net: number;
};

type Props = {
  staff: StaffListRow[];
  payrollLines: PayrollLine[];
  configured: boolean;
  canCreate: boolean;
  adminConfigured: boolean;
};

export function StaffClient({
  staff,
  payrollLines,
  configured,
  canCreate,
  adminConfigured,
}: Props) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [advanceStaff, setAdvanceStaff] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    login_id: "",
    password: "",
    name: "",
    hourly_wage: 0,
  });

  if (!configured) {
    return <p className="text-on-surface-variant">Supabase 연결 후 사용 가능합니다.</p>;
  }

  async function checkIn(id: string) {
    const r = await staffCheckIn(id, pin || undefined);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  async function checkOut(id: string) {
    const r = await staffCheckOut(id);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  async function handleAdvance() {
    if (!advanceStaff || advanceAmount <= 0) return;
    const r = await recordStaffAdvance(advanceStaff, advanceAmount);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const r = await createStaffAccount({
      login_id: form.login_id,
      password: form.password,
      name: form.name,
      hourly_wage: form.hourly_wage,
    });
    setPending(false);
    if ("error" in r && r.error) {
      alert(r.error);
      return;
    }
    setCreateOpen(false);
    setForm({ login_id: "", password: "", name: "", hourly_wage: 0 });
    router.refresh();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs text-on-surface-variant flex-1 min-w-[140px]">
          수동 출근 PIN (선택)
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="login-input block mt-1 w-full"
            maxLength={6}
          />
        </label>
        {canCreate && (
          <button
            type="button"
            disabled={!adminConfigured || pending}
            onClick={() => setCreateOpen(true)}
            className="btn-primary h-10 px-4 rounded-xl text-sm disabled:opacity-50"
          >
            + 직원 계정
          </button>
        )}
      </div>

      {!adminConfigured && canCreate && (
        <p className="text-xs text-on-surface-variant">
          직원 로그인 계정을 만들려면 <code className="text-primary">SUPABASE_SERVICE_ROLE_KEY</code>가
          필요합니다.
        </p>
      )}

      <section className="space-y-3">
        {staff.map((s) => {
          const line = payrollLines.find((p) => p.staffId === s.id);
          return (
            <div key={s.id} className="glass-panel rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {s.login_id ? `ID ${s.login_id}` : "계정 없음"}
                  {" · "}
                  {s.role} · 시급 {formatMp(s.hourly_wage)}
                  {line && ` · ${line.hours}h · 실지급 ${formatMp(line.net)}`}
                </p>
                <p className="text-xs mt-1">
                  {s.working ? (
                    <span className="text-primary">
                      근무 중
                      {s.todayIn ? ` · 출근 ${formatTimeHHmmKST(s.todayIn)}` : ""}
                    </span>
                  ) : s.todayIn ? (
                    <span className="text-on-surface-variant">
                      오늘 출근 {formatTimeHHmmKST(s.todayIn)}
                      {s.todayOut ? ` · 퇴근 ${formatTimeHHmmKST(s.todayOut)}` : ""}
                    </span>
                  ) : (
                    <span className="text-on-surface-variant/70">오늘 출근 기록 없음</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => checkIn(s.id)}
                  className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm"
                >
                  출근
                </button>
                <button
                  type="button"
                  onClick={() => checkOut(s.id)}
                  className="px-3 py-2 rounded-lg border border-white/10 text-sm"
                >
                  퇴근
                </button>
              </div>
            </div>
          );
        })}
        {staff.length === 0 && (
          <p className="text-on-surface-variant text-sm">직원 계정 버튼으로 아이디를 부여하세요.</p>
        )}
      </section>

      <section className="glass-panel rounded-xl p-5">
        <h2 className="font-bold mb-3">가불 등록</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={advanceStaff}
            onChange={(e) => setAdvanceStaff(e.target.value)}
            className="login-input"
          >
            <option value="">직원</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={advanceAmount || ""}
            onChange={(e) => setAdvanceAmount(Number(e.target.value))}
            placeholder="금액"
            className="login-input w-32"
          />
          <button type="button" onClick={handleAdvance} className="btn-primary px-4 py-2 rounded-lg text-sm">
            가불 기록
          </button>
        </div>
      </section>

      {createOpen && (
        <AppModal
          onClose={() => setCreateOpen(false)}
          title="직원 계정 생성"
          subtitle="리모컨 앱 로그인용 아이디를 부여합니다"
          accent="primary"
          maxWidth="md"
          titleId="staff-create-title"
          footer={
            <>
              <button type="button" onClick={() => setCreateOpen(false)} className="app-modal-btn-secondary">
                취소
              </button>
              <button
                type="submit"
                form="staff-create-form"
                disabled={pending}
                className="flex-1 h-11 rounded-xl text-sm font-bold btn-primary disabled:opacity-50"
              >
                {pending ? "처리 중…" : "계정 생성"}
              </button>
            </>
          }
        >
          <form id="staff-create-form" onSubmit={handleCreate} autoComplete="off" className="space-y-4">
            <label>
              <span className="app-modal-label">이름</span>
              <input
                required
                className="app-modal-field"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="홍길동"
              />
            </label>
            <label>
              <span className="app-modal-label">로그인 아이디</span>
              <input
                required
                className="app-modal-field"
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_]+"
                value={form.login_id}
                onChange={(e) => setForm((f) => ({ ...f, login_id: e.target.value.toLowerCase() }))}
                placeholder="staff01"
              />
              <p className="text-[10px] text-on-surface-variant/70 mt-1">영문 소문자·숫자·_ (3~32자)</p>
            </label>
            <label>
              <span className="app-modal-label">비밀번호</span>
              <input
                type="password"
                required
                minLength={6}
                className="app-modal-field"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="6자 이상"
              />
            </label>
            <label>
              <span className="app-modal-label">시급 (원)</span>
              <input
                type="number"
                min={0}
                className="app-modal-field"
                value={form.hourly_wage || ""}
                onChange={(e) => setForm((f) => ({ ...f, hourly_wage: Number(e.target.value) }))}
                placeholder="15000"
              />
            </label>
          </form>
        </AppModal>
      )}
    </div>
  );
}
