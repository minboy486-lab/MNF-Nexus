"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

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

async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
  }
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
  const [camError, setCamError] = useState<string | null>(null);
  const [camDenied, setCamDenied] = useState(false);
  const [retry, setRetry] = useState(0);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let stopped = false;
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

    const schedule = (fn: () => void) => {
      if (stopped) return;
      if (videoWithVfc.requestVideoFrameCallback) {
        vfc = videoWithVfc.requestVideoFrameCallback(() => fn());
      } else {
        raf = requestAnimationFrame(fn);
      }
    };

    const capture = (raw: string) => {
      if (lockedRef.current || stopped) return;
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
          if (stopped || pausedRef.current) return;
          lockedRef.current = false;
          setPhase("scanning");
          void video.play().catch(() => undefined);
        }, 700);
      }
    };

    const tick = async () => {
      if (stopped) return;
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
      if (!stopped) schedule(() => void tick());
    };

    async function start() {
      if (!video) return;
      try {
        stream = await openCamera();
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        await preferContinuousFocus(stream);
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();
        setCamError(null);
        setCamDenied(false);
      } catch (err) {
        const denied =
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
        setCamDenied(denied);
        setCamError(
          denied
            ? "카메라 권한을 허용해 주세요. 여기를 누르면 다시 요청합니다."
            : "카메라를 열 수 없습니다. 여기를 눌러 다시 시도해 주세요.",
        );
        return;
      }
      const Detector = getDetector();
      detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      schedule(() => void tick());
    }

    void start();
    return () => {
      stopped = true;
      cancelLoop();
      if (shutterTimer.current) window.clearTimeout(shutterTimer.current);
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [retry]);

  const frozen = phase !== "scanning";
  const badge =
    camError ??
    (phase === "busy"
      ? busyLabel
      : phase === "captured"
        ? "촬영됨 · QR 인식"
        : "스캔 중 · QR을 네모 안에");

  function retryCamera() {
    if (camDenied && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      window.location.href = "app-settings:";
    }
    setCamError(null);
    setCamDenied(false);
    setRetry((n) => n + 1);
  }

  return (
    <div className="space-y-3">
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
          {!frozen && <span className="staff-qr__scanline" />}
        </div>
        <div
          className={`staff-qr__badge${frozen ? " staff-qr__badge--ok" : ""}${camError ? " staff-qr__badge--action" : ""}`}
          role={camError ? "button" : undefined}
          tabIndex={camError ? 0 : undefined}
          onClick={camError ? retryCamera : undefined}
          onKeyDown={
            camError
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    retryCamera();
                  }
                }
              : undefined
          }
        >
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
      </div>
      {camError ? (
        <button
          type="button"
          className="w-full text-sm text-error text-center underline underline-offset-2"
          onClick={retryCamera}
        >
          {camDenied
            ? "권한을 허용해 주세요. 눌러서 다시 요청하거나, 아이폰은 설정 앱으로 이동합니다."
            : camError}
        </button>
      ) : (
        <p className="text-sm text-on-surface-variant text-center">
          {frozen ? "촬영된 화면입니다. 잠시만 기다려 주세요." : hint}
        </p>
      )}
    </div>
  );
}
