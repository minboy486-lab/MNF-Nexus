"use client";

import { useEffect, useRef } from "react";

type Props = {
  play: boolean;
  onPlayed?: () => void;
};

export function BlindUpSound({ play, onPlayed }: Props) {
  const playedRef = useRef(false);

  useEffect(() => {
    if (!play || playedRef.current) return;
    playedRef.current = true;

    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      /* ignore */
    }

    onPlayed?.();
  }, [play, onPlayed]);

  useEffect(() => {
    if (!play) playedRef.current = false;
  }, [play]);

  return null;
}
