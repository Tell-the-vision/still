"use client";

/** Direct URL entry (HOME-03) — the same validation as the QR scanner. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { api, ApiError } from "@/lib/client/fetcher";
import { extractExhibitionRef } from "@/components/QrScanner";

export function UrlEntry() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = extractExhibitionRef(value);
    if (!ref) {
      setError("유효한 전시 URL이 아닙니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { exhibition } = await api<{ exhibition: { slug: string } }>(`/api/exhibitions/${encodeURIComponent(ref)}`);
      router.push(`/e/${exhibition.slug}`);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "존재하지 않거나 종료된 전시입니다." : "전시를 확인하지 못했습니다.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void go(e)}>
      <label htmlFor="home-url" className="label block mb-2">
        전시 URL로 입장
      </label>
      <div className="flex gap-2">
        <input
          id="home-url"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…/e/flow-of-things"
          className="flex-1 min-w-0 h-12 border-b border-ink text-[14px] placeholder:text-muted/60"
        />
        <Button type="submit" variant="secondary" className="h-12 px-5" disabled={!value.trim()} loading={busy}>
          Go
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </form>
  );
}
