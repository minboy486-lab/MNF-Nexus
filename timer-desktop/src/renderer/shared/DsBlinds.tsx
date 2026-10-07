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
 * Ante 있는 게임: 무조건
 *   BLINDS  SB / BB
 *   ANTE    N
 * 두 줄 (송출 화면 기준 레이아웃).
 */
export function DsBlinds({ isBreak, pauseLabel = "BREAK TIME", small, big, ante }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hasAnte = ante > 0;

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const fit = () => {
      setZoom(el, 1);
      setScale(el, 1);
      if (isBreak) return;

      fitScale(el, 0.45);
      if (!overflows(el)) return;

      const avail = Math.max(1, el.clientWidth - 4);
      const need = contentWidth(el);
      if (need > avail) {
        setZoom(el, Math.max(0.28, avail / need));
      }
    };

    fit();
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
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

  if (hasAnte) {
    return (
      <div className="ds-blinds ds-blinds--with-ante" ref={rootRef}>
        <div className="ds-blinds__inner">
          <span className="ds-blinds__label">BLINDS</span>
          <span className="ds-blinds__val">
            {small.toLocaleString()} / {big.toLocaleString()}
          </span>
          <span className="ds-blinds__label">ANTE</span>
          <span className="ds-blinds__val">{ante.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-blinds" ref={rootRef}>
      <div className="ds-blinds__inner">
        <span className="ds-blinds__label">BLINDS</span>
        <span className="ds-blinds__val">
          {small.toLocaleString()} / {big.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
