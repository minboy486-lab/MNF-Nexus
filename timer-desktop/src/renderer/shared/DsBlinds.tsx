import { useLayoutEffect, useRef } from "react";

type Props = {
  isBreak?: boolean;
  pauseLabel?: string;
  small: number;
  big: number;
  ante: number;
};

function overflows(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1;
}

/** 블라인드 한 줄 유지. 넘치면 엔티를 아래로, 그래도 넘치면 글자만 같이 축소. */
export function DsBlinds({ isBreak, pauseLabel = "BREAK TIME", small, big, ante }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const fit = () => {
      el.classList.remove("ds-blinds--stacked");
      el.style.setProperty("--blinds-scale", "1");
      if (isBreak) return;

      if (overflows(el)) el.classList.add("ds-blinds--stacked");
      if (!overflows(el)) return;

      let lo = 0.42;
      let hi = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        el.style.setProperty("--blinds-scale", String(mid));
        if (overflows(el)) hi = mid;
        else lo = mid;
      }
      el.style.setProperty("--blinds-scale", String(Math.max(0.42, lo)));
    };

    fit();
    let lastW = el.clientWidth;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      if (Math.abs(w - lastW) < 1) return;
      lastW = w;
      fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isBreak, pauseLabel, small, big, ante]);

  if (isBreak) {
    return (
      <div className="ds-blinds" ref={rootRef}>
        <span className="ds-blinds__val ds-blinds__val--break">{pauseLabel}</span>
      </div>
    );
  }

  const hasAnte = ante > 0;
  return (
    <div className="ds-blinds" ref={rootRef}>
      <div className="ds-blinds__inner">
        <div className="ds-blinds__row">
          <span className="ds-blinds__label">BLINDS</span>
          <span className="ds-blinds__val">
            {small.toLocaleString()} / {big.toLocaleString()}
          </span>
        </div>
        {hasAnte && (
          <div className="ds-blinds__row ds-blinds__row--ante">
            <span className="ds-blinds__label">ANTE</span>
            <span className="ds-blinds__val">{ante.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
