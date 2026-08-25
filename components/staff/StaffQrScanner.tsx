"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  isCameraDeniedError,
  openAppSettings,
  openStaffCamera,
  queryCameraPermission,
} from "@/lib/staff/staff-camera";

type Props = {
  hint: string;
  paused?: boolean;
  busy?: boolean;
  busyLabel?: string;
  /** true면 화면을 멈춘 채 유지, false면 잠깐 보여 주고 다시 스캔 */
  onDetect: (text: string) => boolean;
};

type DetectorCtor = new (opts: { formats: string[] }) => {
  detect: (src: HTMLVideoElement | ImageBitmap | HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>;
};

type Phase = "scanning" | "captured" | "busy";

function getDetector(): DetectorCtor | null {
  return (
    (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ?? null
  );
}

async function preferContinuousFocus(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  try {
    const caps = track.getCapabilities?.() as { focusMode?: string[] } | undefined;
    if (caps?.focusMode?.includes("continuous")) {
      await track.applyConstraints({
        advanced: [{ focusMode: "continuous" } as unknown as MediaTrackConstraintSet],
      });
    }
  } catch {
    /* some browsers reject focus constraints */
  }
}

function drawFreezeFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
}

function scanWithJsQR(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const side = Math.min(vw, vh) * 0.78;
  const sx = (vw - side) / 2;
  const sy = (vh - side) / 2;
  const out = 400;
  if (canvas.width !== out || canvas.height !== out) {
    canvas.width = out;
    canvas.height = out;
  }
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, out, out);
  const imageData = ctx.getImageData(0, 0, out, out);
  return jsQR(imageData.data, out, out, { inversionAttempts: "dontInvert" })?.data ?? null;
}

export function StaffQrScanner({ hint, paused, busy, busyLabel = "촬영됨 · 출근 등록 중", onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);
  const freezeCanvasRef = useRef<HTMLCanvasElement>(null);
  const onDetectRef = useRef(onDetect);
  const pausedRef = useRef(!!paused);
  const lockedRef = useRef(false);
  const shutterTimer = useRef<number | null>(null);
  const resumeTimer = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelLoopRef = useRef<(() => void) | null>(null);
  const stoppedRef = useRef(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [camDenied, setCamDenied] = useState(false);
  const [phase, setPhase] = useState<Phase>("scanning");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    pausedRef.current = !!paused;
    if (paused || busy) {
      lockedRef.current = true;
      setPhase("busy");
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    lockedRef.current = false;
    setPhase("scanning");
    void videoRef.current?.play().catch(() => undefined);
  }, [paused, busy]);

  const beginScanLoop = useCallback((video: HTMLVideoElement) => {
    cancelLoopRef.current?.();
    let inFlight = false;
    let raf = 0;
    let vfc = 0;
    let detector: InstanceType<DetectorCtor> | null = null;
    const videoWithVfc = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };

    const cancelLoop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (vfc && videoWithVfc.cancelVideoFrameCallback) {
        videoWithVfc.cancelVideoFrameCallback(vfc);
      }
      vfc = 0;
    };
    cancelLoopRef.current = cancelLoop;

    const schedule = (fn: () => void) => {
      if (stoppedRef.current) return;
      if (videoWithVfc.requestVideoFrameCallback) {
        vfc = videoWithVfc.requestVideoFrameCallback(() => fn());
      } else {
        raf = requestAnimationFrame(fn);
      }
    };

    const capture = (raw: string) => {
      if (lockedRef.current || stoppedRef.current) return;
      lockedRef.current = true;
      const freeze = freezeCanvasRef.current;
      if (freeze) drawFreezeFrame(video, freeze);
      try {
        video.pause();
      } catch {
        /* ignore */
      }
      setPhase("captured");
      setFlash(true);
      if (shutterTimer.current) window.clearTimeout(shutterTimer.current);
      shutterTimer.current = window.setTimeout(() => setFlash(false), 220);
      try {
        navigator.vibrate?.(40);
      } catch {
        /* iOS */
      }
      const keepFrozen = onDetectRef.current(raw);
      if (!keepFrozen) {
        if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
        resumeTimer.current = window.setTimeout(() => {
          if (stoppedRef.current || pausedRef.current) return;
          lockedRef.current = false;
          setPhase("scanning");
          void video.play().catch(() => undefined);
        }, 700);
      }
    };

    const tick = async () => {
      if (stoppedRef.current) return;
      if (!inFlight && !pausedRef.current && !lockedRef.current && video.readyState >= 2) {
        inFlight = true;
        try {
          let raw: string | null = null;
          if (detector) {
            const codes = await detector.detect(video);
            raw = codes[0]?.rawValue?.trim() || null;
          }
          if (!raw && scanCanvasRef.current) {
            raw = scanWithJsQR(video, scanCanvasRef.current);
          }
          if (raw) capture(raw);
        } catch {
          /* keep scanning */
        } finally {
          inFlight = false;
        }
      }
      if (!stoppedRef.current) schedule(() => void tick());
    };

    const Detector = getDetector();
    detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
    schedule(() => void tick());
  }, []);

  const attachStream = useCallback(
    async (stream: MediaStream) => {
      const video = videoRef.current;
      if (!video || stoppedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      await preferContinuousFocus(stream);
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();
      setCamError(null);
      setCamDenied(false);
      lockedRef.current = !!pausedRef.current;
      setPhase(pausedRef.current ? "busy" : "scanning");
      beginScanLoop(video);
    },
    [beginScanLoop],
  );

  const startCamera = useCallback(
    async (stream?: MediaStream) => {
      try {
        const next = stream ?? (await openStaffCamera());
        if (stoppedRef.current) {
          next.getTracks().forEach((t) => t.stop());
          return false;
        }
        await attachStream(next);
        return true;
      } catch (err) {
        const denied = isCameraDeniedError(err);
        setCamDenied(denied);
        setCamError(denied ? "카메라 권한" : "카메라 오류");
        return false;
      }
    },
    [attachStream],
  );

  useEffect(() => {
    stoppedRef.current = false;
    void startCamera();
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (streamRef.current?.getVideoTracks().some((t) => t.readyState === "live")) return;
      void startCamera();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stoppedRef.current = true;
      document.removeEventListener("visibilitychange", onVisible);
      cancelLoopRef.current?.();
      if (shutterTimer.current) window.clearTimeout(shutterTimer.current);
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [startCamera]);

  const frozen = phase !== "scanning";
  const badge =
    camError ??
    (phase === "busy"
      ? busyLabel
      : phase === "captured"
        ? "촬영됨 · QR 인식"
        : "스캔 중");

  async function allowCamera() {
    const state = await queryCameraPermission();
    if (state === "denied") {
      openAppSettings();
      return;
    }
    try {
      const stream = await openStaffCamera();
      await startCamera(stream);
    } catch (err) {
      const denied = isCameraDeniedError(err);
      setCamDenied(denied);
      setCamError(denied ? "카메라 권한" : "카메라 오류");
      if (denied && state === "unknown") openAppSettings();
    }
  }

  return (
    <div className="space-y-3 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
      <div className={`staff-qr ${frozen ? "staff-qr--frozen" : ""}`} data-phase={phase}>
        <video
          ref={videoRef}
          className="staff-qr__video"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={freezeCanvasRef}
          className="staff-qr__freeze"
          hidden={!frozen}
          aria-hidden
        />
        <canvas ref={scanCanvasRef} className="hidden" />
        <div className={`staff-qr__shutter${flash ? " is-on" : ""}`} aria-hidden />
        <div className="staff-qr__frame" aria-hidden>
          <span className="staff-qr__corner staff-qr__corner--tl" />
          <span className="staff-qr__corner staff-qr__corner--tr" />
          <span className="staff-qr__corner staff-qr__corner--bl" />
          <span className="staff-qr__corner staff-qr__corner--br" />
          {!frozen && !camError && <span className="staff-qr__scanline" />}
        </div>
        {!camError && (
          <div className={`staff-qr__badge${frozen ? " staff-qr__badge--ok" : ""}`}>
            {phase === "busy" ? (
              <svg className="staff-qr__badge-icon staff-qr__badge-icon--spin" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="36 14" />
              </svg>
            ) : frozen ? (
              <svg className="staff-qr__badge-icon" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.18" />
                <path d="M7.5 12.4 10.4 15.2 16.5 8.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="staff-qr__badge-icon" viewBox="0 0 24 24" aria-hidden>
                <rect x="4" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <rect x="14" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <rect x="4" y="14" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M14 14h3v3h-3zM19 14h1v1M14 19h1M18 18h2v2" fill="currentColor" />
              </svg>
            )}
            {badge}
          </div>
        )}
      </div>
      {camError ? (
        <button
          type="button"
          className="w-full min-h-12 rounded-xl bg-primary text-on-primary text-sm font-bold active:scale-[0.97] transition-transform"
          onClick={() => void allowCamera()}
        >
          {camDenied ? "권한 허용" : "다시 시도"}
        </button>
      ) : (
        <p className="text-sm text-on-surface-variant text-center">
          {frozen ? "잠시만 기다려 주세요" : hint}
        </p>
      )}
    </div>
  );
}
