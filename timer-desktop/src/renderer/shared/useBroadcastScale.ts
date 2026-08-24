import { useLayoutEffect, useState, type RefObject } from "react";

export const BROADCAST_W = 1920;
export const BROADCAST_H = 1080;

/** 셸 실측 크기에 맞춰 1920×1080 스테이지 scale (잘림 방지용 여유 포함) */
export function useBroadcastScale(
  shellRef: RefObject<HTMLElement | null>,
  /** 1 = 꽉 채움, 0.96 = TV/윈도우 가장자리 여유 */
  fit = 0.96,
) {
  const [scale, setScale] = useState(0.5);

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) return;
      setScale(Math.min(w / BROADCAST_W, h / BROADCAST_H) * fit);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [shellRef, fit]);

  return scale;
}
