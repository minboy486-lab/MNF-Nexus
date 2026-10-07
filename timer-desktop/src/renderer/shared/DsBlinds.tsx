import { useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  isBreak?: boolean;
  pauseLabel?: string;
  small: number;
  big: number;
  ante: number;
};

/** 부모 너비에 맞게 zoom으로 맞춘다 (NEXT 줄 등). */
export function FitToWidth({
  className,
  children,
  watch,
}: {
  className?: string;
  children: ReactNode;
  watch: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      el.style.removeProperty("zoom");
      const parent = el.parentElement;
      const avail = Math.max(1, (parent?.clientWidth ?? el.clientWidth) - 4);
      const need = el.scrollWidth;
      if (need > avail + 1) {
        el.style.zoom = String(Math.max(0.35, avail / need));
      }
    };

    fit();
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [watch]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function contentWidth(el: HTMLElement): number {
  // zoom/transform 영향을 피하고 실제 글자 폭을 본다
  const inner = el.querySelector(".ds-blinds__inner") as HTMLElement | null;
  if (!inner) return el.scrollWidth;
  const prevZoom = inner.style.zoom;
  inner.style.zoom = "1";
  const w = Math.ceil(inner.scrollWidth);
  inner.style.zoom = prevZoom;
  return w;
}

function overflows(el: HTMLElement): boolean {
  return contentWidth(el) > el.clientWidth + 1;
}

function setScale(el: HTMLElement, scale: number) {
  el.style.setProperty("--blinds-scale", String(scale));
}

function setZoom(el: HTMLElement, zoom: number) {
  const inner = el.querySelector(".ds-blinds__inner") as HTMLElement | null;
  if (!inner) return;
  if (zoom >= 0.999) inner.style.removeProperty("zoom");
  else inner.style.zoom = String(zoom);
}

/** --blinds-scale 이진 탐색 (테마 고정 font-size에도 calc로 곱해짐). */
function fitScale(el: HTMLElement, minScale: number): void {
  setZoom(el, 1);
  setScale(el, 1);
  if (!overflows(el)) return;

  let lo = minScale;
  let hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    setScale(el, mid);
    if (overflows(el)) hi = mid;
    else lo = mid;
  }
  setScale(el, Math.max(minScale, lo));
}

/**
 * 블라인드: SB / BB · Ante.
 * 큰 화면+테마 고정 글자크기에서도 잘리지 않게
 * 한 줄 축소 → Ante 아래 → 스택 → zoom 폴백.
 */
export function DsBlinds({ isBreak, pauseLabel = "BREAK TIME", small, big, ante }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hasAnte = ante > 0;

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const fit = () => {
      el.classList.remove("ds-blinds--ante-wrap", "ds-blinds--stacked");
      setZoom(el, 1);
      setScale(el, 1);
      if (isBreak) return;

      // 1) 한 줄 — 살짝만 줄인다 (크게 뭉개지 않음)
      fitScale(el, 0.78);
      if (!overflows(el)) return;

      // 2) Ante를 아래로 (큰 자릿수·큰 모니터에서 가장 자연스러움)
      if (hasAnte) {
        el.classList.add("ds-blinds--ante-wrap");
        fitScale(el, 0.5);
        if (!overflows(el)) return;
      }

      // 3) BLINDS 라벨 위 + Ante 아래
      el.classList.add("ds-blinds--stacked");
      if (hasAnte) el.classList.add("ds-blinds--ante-wrap");
      fitScale(el, 0.42);
      if (!overflows(el)) return;

      // 4) 마지막: 블록 전체를 가용 너비에 맞게 zoom (어떤 font-size여도 보장)
      const avail = Math.max(1, el.clientWidth - 4);
      const need = contentWidth(el);
      if (need > avail) {
        setZoom(el, Math.max(0.28, avail / need));
      }
    };

    fit();
    const ro = new ResizeObserver(() => {
      // rAF로 레이아웃 확정 후 재측정 (테마 font-size 적용 이후)
      requestAnimationFrame(fit);
    });
    ro.observe(el);
    const parent = el.parentElement;
    if (parent) ro.observe(parent);
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
