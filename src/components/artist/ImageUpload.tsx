"use client";

/**
 * Cover image picker: paste a URL or upload a file. Uploads are resized in
 * the browser (max 1600px, JPEG) and stored via POST /api/images.
 */
import { useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { ApiError } from "@/lib/client/fetcher";

const MAX_EDGE = 1600;

async function resizeToJpeg(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("이미지를 변환하지 못했습니다.");
  return { blob, width: w, height: h };
}

export function ImageUpload({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { blob, width, height } = await resizeToJpeg(file);
      const fd = new FormData();
      fd.append("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
      fd.append("width", String(width));
      fd.append("height", String(height));
      const res = await fetch("/api/images", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
        throw new ApiError(res.status, j.error?.code ?? "UNKNOWN", j.error?.message ?? "업로드에 실패했습니다.");
      }
      const { url } = (await res.json()) as { url: string };
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했습니다.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="대표 이미지 미리보기" className="w-full aspect-[4/5] object-cover bg-line mb-3" />
      ) : (
        <div className="w-full aspect-[4/5] bg-line mb-3 flex items-center justify-center text-muted text-xs">대표 이미지 없음</div>
      )}
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <Button type="button" variant="secondary" className="h-10 text-xs" onClick={() => fileRef.current?.click()} loading={busy} disabled={disabled}>
          이미지 업로드
        </Button>
        {value && (
          <Button type="button" variant="text" className="text-xs text-muted" onClick={() => onChange("")} disabled={disabled || busy}>
            제거
          </Button>
        )}
      </div>
      <input
        type="url"
        value={value.startsWith("/api/images/") ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="또는 이미지 URL (https://…)"
        className="w-full h-10 border-b border-line text-sm mt-2"
        disabled={disabled || busy}
        aria-label="대표 이미지 URL"
      />
      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
