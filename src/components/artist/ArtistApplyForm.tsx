"use client";

/** Artist verification request → artistStatus=PENDING until an admin decides. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import type { PublicUser } from "@/lib/api";
import { track } from "@/lib/client/analytics";
import { api, errorMessage } from "@/lib/client/fetcher";

export function ArtistApplyForm({ me, next }: { me: PublicUser; next: string }) {
  const router = useRouter();
  const [artistName, setArtistName] = useState(me.artistName ?? me.displayName ?? "");
  const [bio, setBio] = useState(me.artistBio ?? "");
  const [portfolio, setPortfolio] = useState(me.artistPortfolioUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/users/me/artist-application", {
        method: "POST",
        body: { artistName, artistBio: bio, artistPortfolioUrl: portfolio },
      });
      track("artist_apply");
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "신청을 보내지 못했습니다."));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="px-5 pb-10">
      {me.artistStatus === "REJECTED" && (
        <div className="mb-5">
          <Notice tone="error">
            이전 신청이 반려되었습니다.{me.artistReviewNote ? ` 사유: ${me.artistReviewNote}` : ""} 내용을 보완해 다시 신청할 수 있습니다.
          </Notice>
        </div>
      )}
      <p className="text-sm leading-6 text-muted mb-6">
        아티스트로 승인되면 전시를 직접 등록하고, 해설 가이드를 작성하고, 전시장용 QR 코드를 받을 수 있습니다. 승인은 관리자가 검토한 뒤 이루어집니다.
      </p>
      <label className="block mb-5">
        <span className="block text-xs text-muted mb-1">아티스트 이름 *</span>
        <input className="w-full h-11 border-b border-line text-[15px]" value={artistName} onChange={(e) => setArtistName(e.target.value)} maxLength={40} required />
      </label>
      <label className="block mb-5">
        <span className="block text-xs text-muted mb-1">소개 · 활동 (선택)</span>
        <textarea className="w-full border-b border-line text-[15px] leading-7 resize-none py-2" rows={4} value={bio} onChange={(e) => setBio(e.target.value.slice(0, 600))} placeholder="어떤 작업을 하시는지, 어떤 전시를 열 예정인지 적어 주세요." />
        <span className="block text-muted text-xs mt-1 text-right">{bio.length} / 600</span>
      </label>
      <label className="block mb-6">
        <span className="block text-xs text-muted mb-1">포트폴리오 / SNS 링크 (선택)</span>
        <input type="url" className="w-full h-11 border-b border-line text-[15px]" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://" />
      </label>
      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <Button full type="submit" loading={busy} disabled={!artistName.trim()}>
        아티스트 인증 신청
      </Button>
    </form>
  );
}
