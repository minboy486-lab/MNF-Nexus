import Link from "next/link";
import { GuestPasswordForm } from "@/components/guest/GuestPasswordForm";
import { signOut } from "@/lib/actions/auth";

export default function GuestSettingsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/guest"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-white/10 text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors"
          aria-label="홈으로"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-xl font-bold">계정 설정</h1>
          <p className="text-sm text-on-surface-variant">비밀번호 · 로그아웃</p>
        </div>
      </div>

      <GuestPasswordForm />

      <form action={signOut}>
        <button
          type="submit"
          className="w-full py-3 rounded-xl text-sm font-semibold border border-white/15 text-on-surface-variant hover:text-error hover:border-error/30 hover:bg-error/5 transition-colors"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
