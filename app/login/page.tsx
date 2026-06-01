import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex flex-col md:flex-row relative overflow-hidden">
      <div className="bg-mesh" aria-hidden />
      <div className="hidden md:flex md:w-1/2 flex-col justify-between p-12 border-r border-white/10 relative z-10">
        <p className="text-2xl font-bold tracking-tight bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
          MNF HOLDEM
        </p>
        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight mb-6 tracking-tight">
            데이터 기반의
            <br />
            <span className="text-primary text-glow-primary">프리미엄 포커</span> 운영
          </h2>
          <p className="text-on-surface-variant text-lg font-medium">
            실시간 테이블 동기화와 토너먼트 타이머를 하나의 Nexus 콘솔에서.
          </p>
        </div>
        <p className="text-on-surface-variant/50 text-[11px] uppercase tracking-[0.25em]">
          Professional Grade
        </p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="md:hidden text-center mb-4">
            <p className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              MNF HOLDEM
            </p>
          </div>
          {!isSupabaseConfigured() ? (
            <div className="glass-panel rounded-2xl p-6 space-y-4 text-left">
              <h2 className="text-lg font-bold text-on-surface">Supabase 연결 필요</h2>
              <p className="text-on-surface-variant text-sm">
                프로젝트 루트에 <code className="text-primary">.env.local</code> 파일을
                만들고 아래 값을 넣은 뒤, 개발 서버를 다시 시작하세요 (
                <code className="text-xs">npm run dev</code>).
              </p>
              <pre className="text-[11px] bg-white/5 rounded-xl p-3 overflow-x-auto text-on-surface-variant border border-white/10">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...`}
              </pre>
              <p className="text-on-surface-variant text-xs">
                Supabase → Project Settings → API 에서 URL과{" "}
                <strong className="text-on-surface">anon public</strong> 키를 복사합니다.
              </p>
              <Link
                href="/admin/dashboard"
                className="block w-full text-center border border-white/15 text-on-surface-variant font-semibold py-3.5 rounded-xl hover:border-primary/40 hover:text-primary transition-colors"
              >
                데모 UI로 먼저 둘러보기
              </Link>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-8">
              <LoginForm />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
