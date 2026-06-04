import { signOut } from "@/lib/actions/auth";

export default function CounterWrongDevicePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-8 bg-[#0d0b11] text-center">
      <div className="bg-mesh" aria-hidden />
      <div className="relative z-10 max-w-md space-y-6">
        <span className="material-symbols-outlined text-5xl text-primary">tablet</span>
        <h1 className="text-2xl font-bold">접수대는 태블릿에서 이용</h1>
        <p className="text-on-surface-variant text-sm leading-relaxed">
          이 계정은 매장 접수대 전용입니다. 카운터에 설치된 태블릿(또는 iPad)에서 로그인해
          주세요.
        </p>
        <form action={signOut}>
          <button type="submit" className="btn-primary px-6 py-3 rounded-lg">
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
