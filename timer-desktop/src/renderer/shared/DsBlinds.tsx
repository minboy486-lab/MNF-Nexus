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

function setScale(el: HTMLElement, scale: number) {
  el.style.setProperty("--blinds-scale", String(scale));
}

/** 넘치지 않는 최대 scale을 이진 탐색으로 찾는다. */
function fitScale(el: HTMLElement, minScale: number): void {
  setScale(el, 1);
  if (!overflows(el)) return;

  let lo = minScale;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    setScale(el, mid);
    if (overflows(el)) hi = mid;
    else lo = mid;
  }
  setScale(el, Math.max(minScale, lo));
}

/**
 * 블라인드 한 줄: SB / BB · Ante X.
 * 좁으면 글자 축소 → Ante 아래 줄 → 라벨/숫자 스택 순으로 맞춰 좌우 잘림을 막는다.
 */
export function DsBlinds({ isBreak, pauseLabel = "BREAK TIME", small, big, ante }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hasAnte = ante > 0;

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const fit = () => {
      el.classList.remove("ds-blinds--ante-wrap", "ds-blinds--stacked");
      setScale(el, 1);
      if (isBreak) return;

      // 1) 한 줄 + 적당한 축소 (너무 작아지지 않게)
      fitScale(el, 0.62);
      if (!overflows(el)) return;

      // 2) Ante가 있으면 숫자 아래로 내려 가로를 확보
      if (hasAnte) {
        el.classList.add("ds-blinds--ante-wrap");
        fitScale(el, 0.68);
        if (!overflows(el)) return;
      }

      // 3) 그래도 부족하면 BLINDS 라벨을 위로
      el.classList.remove("ds-blinds--ante-wrap");
      el.classList.add("ds-blinds--stacked");
      if (hasAnte) el.classList.add("ds-blinds--ante-wrap");
      fitScale(el, 0.55);
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
  }, [isBreak, pauseLabel, small, big, ante, hasAnte]);

  if (isBreak) {
    return (
      <div className="ds-blinds" ref={rootRef}>
        <span className="ds-blinds__val ds-blinds__val--break">{pauseLabel}</span>
      </div>
    );
  }

  return (
    <div className="ds-blinds" ref={rootRef}>
      <div className="ds-blinds__inner">
        <div className="ds-blinds__main">
          <span className="ds-blinds__label">BLINDS</span>
          <span className="ds-blinds__val">
            {small.toLocaleString()} / {big.toLocaleString()}
          </span>
        </div>
        {hasAnte && (
          <span className="ds-blinds__ante">
            <span className="ds-blinds__ante-dot" aria-hidden>
              {" · "}
            </span>
            Ante {ante.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
