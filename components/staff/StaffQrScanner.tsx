"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  hint: string;
  paused?: boolean;
  onResult: (text: string) => void;
};

type DetectorCtor = new (opts: { formats: string[] }) => {
  detect: (src: HTMLVideoElement | ImageBitmap) => Promise<Array<{ rawValue?: string }>>;
};

function getDetector(): DetectorCtor | null {
  return (
    (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ?? null
  );
}

async function decodeBitmapWithJsQr(bmp: ImageBitmap): Promise<string | null> {
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { default: jsQR } = await import("jsqr");
  return jsQR(imageData.data, imageData.width, imageData.height)?.data ?? null;
}

export function StaffQrScanner({ hint, paused, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onResultRef = useRef(onResult);
  const pausedRef = useRef(!!paused);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    pausedRef.current = !!paused;
  }, [paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped || !video) return;
        video.srcObject = stream;
        await video.play();
      } catch {
        setCamError("카메라를 열 수 없습니다. 아래 버튼으로 촬영해 주세요.");
        return;
      }

      const Detector = getDetector();
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      const canvas = canvasRef.current;

      const tick = async () => {
        if (stopped || !videoRef.current) return;
        if (!pausedRef.current) {
          try {
            if (detector) {
              const codes = await detector.detect(videoRef.current);
              const raw = codes[0]?.rawValue;
              if (raw) onResultRef.current(raw);
            } else if (canvas && videoRef.current.readyState >= 2) {
              const w = videoRef.current.videoWidth;
              const h = videoRef.current.videoHeight;
              if (w && h) {
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, w, h);
                  const imageData = ctx.getImageData(0, 0, w, h);
                  const { default: jsQR } = await import("jsqr");
                  const raw = jsQR(imageData.data, w, h)?.data;
                  if (raw) onResultRef.current(raw);
                }
              }
            }
          } catch {
            /* keep scanning */
          }
        }
        timer = window.setTimeout(() => void tick(), 280);
      };
      void tick();
    }

    void start();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black aspect-[3/4] max-h-[70dvh]">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="pointer-events-none absolute inset-0 border-2 border-primary/40 rounded-2xl" />
      </div>
      <p className="text-sm text-on-surface-variant text-center">{camError ?? hint}</p>
      <label className="btn-primary h-12 rounded-xl text-sm flex items-center justify-center cursor-pointer">
        사진으로 QR 스캔
        <input
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const bmp = await createImageBitmap(file);
              const Detector = getDetector();
              if (Detector) {
                const codes = await new Detector({ formats: ["qr_code"] }).detect(bmp);
                const raw = codes[0]?.rawValue;
                if (raw) {
                  onResult(raw);
                  return;
                }
              }
              const fromJs = await decodeBitmapWithJsQr(bmp);
              if (fromJs) onResult(fromJs);
              else setCamError("QR을 읽지 못했습니다. 다시 촬영해 주세요.");
            } catch {
              setCamError("QR 인식에 실패했습니다.");
            }
          }}
        />
      </label>
    </div>
  );
}
