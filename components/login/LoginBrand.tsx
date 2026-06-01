type Props = {
  compact?: boolean;
};

function LogoMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/25 flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-xl">playing_cards</span>
      </div>
      <span className="text-sm font-bold tracking-wide text-on-surface">MNF HOLDEM</span>
    </div>
  );
}

export function LoginBrand({ compact }: Props) {
  if (compact) {
    return (
      <div className="px-6 py-5">
        <LogoMark />
        <h1 className="mt-5 text-xl font-bold leading-snug text-on-surface">
          데이터 기반의{" "}
          <span className="text-primary">프리미엄 포커</span> 관리의 정점
        </h1>
      </div>
    );
  }

  return (
    <div className="login-brand-inner">
      <LogoMark />

      <div className="login-brand-copy">
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

      <div className="login-brand-foot">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/55">
          <span className="material-symbols-outlined text-sm">verified_user</span>
          Professional Grade
        </span>
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/55">
          <span className="material-symbols-outlined text-sm">lock</span>
          Secure Infrastructure
        </span>
      </div>
    </div>
  );
}
