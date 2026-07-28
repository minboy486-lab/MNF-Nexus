import { MnfLogo } from "@/components/brand/MnfLogo";

type Props = {
  compact?: boolean;
};

function LogoMark({ compact }: { compact?: boolean }) {
  return (
    <MnfLogo
      variant="horizontal"
      size={compact ? "sm" : "lg"}
      priority
      className={compact ? "login-brand-logo-compact" : undefined}
    />
  );
}

export function LoginBrand({ compact }: Props) {
  if (compact) {
    return (
      <div className="px-6 py-5">
        <LogoMark compact />
      </div>
    );
  }

  return (
    <div className="login-brand-inner">
      <div className="login-brand-shell">
        <div className="login-brand-body">
          <div className="login-brand-logo-wrap">
            <LogoMark />
          </div>
          <div className="login-brand-text">
            <h1 className="text-[2rem] lg:text-[2.5rem] xl:text-[3rem] font-bold leading-[1.2] tracking-tight text-on-surface">
              데이터 기반의
              <br />
              <span className="bg-gradient-to-r from-primary via-[#ffe4f0] to-primary bg-clip-text text-transparent">
                프리미엄 포커
              </span>{" "}
              관리의 정점
            </h1>
            <p className="mt-6 text-[15px] lg:text-base text-on-surface-variant/85 leading-relaxed max-w-md">
              MNF HOLDEM은 전문적인 토너먼트 운영과 데이터 분석을 통해 완벽한 게임 환경을
              제공하는 프리미엄 홀덤펍입니다.
            </p>
          </div>
          <div className="login-brand-spacer" aria-hidden />
        </div>
      </div>
    </div>
  );
}
