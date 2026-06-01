import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./LoginForm";
import { LoginBrand } from "@/components/login/LoginBrand";
import Link from "next/link";

function DemoLoginBlock() {
  return (
    <div className="login-form-shell">
      <div className="login-form-body">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">로그인</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Supabase 연결 후 로그인할 수 있습니다.
          </p>
        </header>
        <div className="rounded-xl p-5 space-y-4 border border-white/10 bg-black/25">
          <p className="text-on-surface-variant text-sm">
            <code className="text-primary">.env.local</code> 에 Supabase URL·키를 넣고
            서버를 재시작하세요.
          </p>
          <pre className="text-[11px] bg-black/40 rounded-lg p-3 overflow-x-auto text-on-surface-variant border border-white/10">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...`}
          </pre>
          <Link href="/admin/dashboard" className="btn-primary login-submit w-full no-underline">
            데모 UI로 둘러보기
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="bg-mesh" aria-hidden />

      <div className="login-split">
        <aside className="login-brand-column">
          <LoginBrand />
        </aside>

        <section className="login-form-column">
          <div className="login-brand-mobile">
            <LoginBrand compact />
          </div>

          {isSupabaseConfigured() ? <LoginForm /> : <DemoLoginBlock />}
        </section>
      </div>
    </div>
  );
}
