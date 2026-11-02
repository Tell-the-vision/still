"use client";

/**
 * QR Scanner (Screen 03).
 *  - Camera via getUserMedia (rear camera preferred).
 *  - Decodes with the native BarcodeDetector when available, else jsQR.
 *  - Permission denied / no camera → URL input fallback (QR-01).
 *  - Validates the exhibition exists before navigating (QR-02 / QR-03).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { track } from "@/lib/client/analytics";
import { api, ApiError } from "@/lib/client/fetcher";

type Phase = "idle" | "starting" | "scanning" | "denied" | "unsupported" | "resolving" | "error";

/** Accepts a full URL (…/e/<slug>), "/e/<slug>", or a bare slug/id. */
export function extractExhibitionRef(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  try {
    const u = new URL(s, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const m = u.pathname.match(/\/e\/([A-Za-z0-9_-]+)/);
    if (m) return m[1];
    // Something like a bare slug typed by hand.
    if (!/[\s/]/.test(s) && /^[A-Za-z0-9_-]+$/.test(s)) return s;
    return null;
  } catch {
    return null;
  }
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const resolveAndGo = useCallback(
    async (raw: string) => {
      const ref = extractExhibitionRef(raw);
      if (!ref) {
        setMessage("유효한 전시 QR / URL이 아닙니다.");
        return false;
      }
      setPhase("resolving");
      try {
        const { exhibition } = await api<{ exhibition: { slug: string } }>(`/api/exhibitions/${encodeURIComponent(ref)}`);
        stopCamera();
        router.push(`/e/${exhibition.slug}`);
        return true;
      } catch (err) {
        setMessage(
          err instanceof ApiError && err.status === 404
            ? "존재하지 않거나 종료된 전시입니다."
            : "전시 정보를 확인하지 못했습니다. 다시 시도해 주세요.",
        );
        return false;
      }
    },
    [router, stopCamera],
  );

  const startCamera = useCallback(async () => {
    setMessage(null);
    doneRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("unsupported");
      return;
    }
    setPhase("starting");
    track("qr_scan_start");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setPhase("scanning");

      const hasDetector = "BarcodeDetector" in window;
      const detector: BarcodeDetectorLike | null = hasDetector
        ? new (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector({ formats: ["qr_code"] })
        : null;
      const jsqr = hasDetector ? null : (await import("jsqr")).default;

      let last = 0;
      const tick = async (ts: number) => {
        if (doneRef.current || !streamRef.current) return;
        if (ts - last > 180 && video.readyState >= 2) {
          last = ts;
          try {
            let value: string | null = null;
            if (detector) {
              const codes = await detector.detect(video);
              value = codes[0]?.rawValue ?? null;
            } else if (jsqr) {
              const canvas = canvasRef.current!;
              const w = (canvas.width = video.videoWidth);
              const h = (canvas.height = video.videoHeight);
              const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              value = jsqr(img.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
            if (value) {
              doneRef.current = true;
              const ok = await resolveAndGo(value);
              if (!ok) {
                // let the user re-scan
                doneRef.current = false;
                setPhase("scanning");
              }
            }
          } catch {
            /* frame decode error — keep going */
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") setPhase("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setPhase("unsupported");
      else {
        setPhase("error");
        setMessage("카메라를 시작하지 못했습니다.");
      }
    }
  }, [resolveAndGo]);

  useEffect(() => {
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const showCamera = phase === "starting" || phase === "scanning" || phase === "resolving";

  return (
    <div className="px-6 pb-10">
      {/* Figma 03 — "Scan to enter." */}
      <div className="pt-6">
        <h1 className="screen-title">Scan to enter.</h1>
        <p className="text-muted text-[13px] leading-5 mt-1">Point your camera at the exhibition QR code.</p>
      </div>

      <div className="relative aspect-square border border-ink bg-paper overflow-hidden mt-8">
        <video
          ref={videoRef}
          className={showCamera ? "w-full h-full object-cover" : "hidden"}
          playsInline
          muted
          aria-label="카메라 미리보기"
        />
        <canvas ref={canvasRef} className="hidden" />
        {/* Scan corners (Figma: 42 × 3px black, 30px inset) */}
        <div className="absolute inset-[30px] pointer-events-none" aria-hidden>
          {[
            "top-0 left-0 border-t-[3px] border-l-[3px]",
            "top-0 right-0 border-t-[3px] border-r-[3px]",
            "bottom-0 left-0 border-b-[3px] border-l-[3px]",
            "bottom-0 right-0 border-b-[3px] border-r-[3px]",
          ].map((pos) => (
            <span key={pos} className={`absolute w-[42px] h-[42px] ${showCamera ? "border-paper" : "border-ink"} ${pos}`} />
          ))}
        </div>
        {!showCamera && (
          <div className="absolute inset-0 flex items-center justify-center px-14 text-center">
            {phase === "idle" ? (
              <span className="label">Camera Preview</span>
            ) : (
              <span className="text-[13px] leading-5 text-muted">
                {phase === "denied" && "카메라 권한이 거부되었습니다. 아래에서 전시 URL을 직접 입력해 주세요."}
                {phase === "unsupported" && "이 기기에서는 카메라를 사용할 수 없습니다. 전시 URL을 직접 입력해 주세요."}
                {phase === "error" && (message ?? "카메라 오류")}
              </span>
            )}
          </div>
        )}
      </div>

      <p className="label mt-3 min-h-[14px]">
        {phase === "scanning" && "QR 코드를 사각형 안에 맞춰 주세요"}
        {phase === "resolving" && "전시 확인 중…"}
        {phase === "starting" && "카메라 권한을 확인하는 중…"}
      </p>

      {message && (
        <div className="mt-3">
          <Notice tone="error" action={phase !== "scanning" ? <Button variant="text" onClick={() => void startCamera()}>다시 스캔</Button> : undefined}>
            {message}
          </Notice>
        </div>
      )}

      {(phase === "denied" || phase === "unsupported" || phase === "error") && (
        <div className="mt-4">
          <Button variant="secondary" full onClick={() => void startCamera()}>
            카메라 다시 시도
          </Button>
        </div>
      )}

      {/* Figma: "Having trouble? You can also open an exhibition link directly." */}
      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          void resolveAndGo(manual);
        }}
      >
        <p className="text-[14px] font-medium">Having trouble?</p>
        <label htmlFor="exhibition-url" className="block text-muted text-[13px] leading-5 mt-1">
          You can also open an exhibition link directly.
        </label>
        <input
          id="exhibition-url"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://…/e/flow-of-things"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          className="w-full h-12 border-b border-ink px-0 mt-3 text-[14px] placeholder:text-muted/60"
        />
        <Button type="submit" full className="mt-5" disabled={!manual.trim() || phase === "resolving"}>
          Enter Exhibition URL
        </Button>
      </form>
    </div>
  );
}
