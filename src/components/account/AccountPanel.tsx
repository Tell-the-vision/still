"use client";

/**
 * Screen 09 — Account: Google user info, audio settings, Logout, Account Deletion.
 * TBD-08 (decided): deleting the account removes every archive and record.
 */
import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useAudio } from "@/components/audio/AudioProvider";
import { Button, Dialog, Notice, SectionTitle, cx } from "@/components/ui";
import type { PublicUser } from "@/lib/api";
import { api, errorMessage } from "@/lib/client/fetcher";
import { formatDate } from "@/lib/format";

const ROLE_LABEL = { USER: "일반 사용자", ARTIST: "아티스트", ADMIN: "관리자" } as const;
const ARTIST_LABEL = { NONE: "", PENDING: "인증 심사 중", APPROVED: "인증 완료", REJECTED: "신청 반려" } as const;

export function AccountPanel({ user }: { user: PublicUser }) {
  const approvedArtist = user.role === "ADMIN" || (user.role === "ARTIST" && user.artistStatus === "APPROVED");
  const audio = useAudio();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = async () => {
    audio.ambienceOff();
    await signOut({ redirectTo: "/" });
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/users/me", { method: "DELETE" });
      audio.ambienceOff();
      await signOut({ redirectTo: "/" });
    } catch (err) {
      setError(errorMessage(err, "계정을 삭제하지 못했습니다."));
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <div className="px-5 pb-10">
      <SectionTitle>User Information</SectionTitle>
      <div className="flex items-center gap-4">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="w-12 h-12 rounded-full object-cover bg-line" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-line" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="font-medium truncate">{user.displayName || "—"}</p>
          <p className="text-muted text-sm truncate">{user.email}</p>
          <p className="text-muted text-xs mt-1">
            가입 {formatDate(user.createdAt)} · {ROLE_LABEL[user.role]}
            {user.status === "SUSPENDED" ? " · 정지됨" : ""}
          </p>
        </div>
      </div>
      {user.status === "SUSPENDED" && (
        <div className="mt-3">
          <Notice tone="error">계정이 정지되었습니다.{user.suspendedReason ? ` 사유: ${user.suspendedReason}` : ""}</Notice>
        </div>
      )}

      <SectionTitle>Artist</SectionTitle>
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="font-medium text-sm">{approvedArtist ? "Artist Studio" : "아티스트 인증"}</p>
          <p className="text-muted text-xs">
            {approvedArtist ? "내 전시 등록 · 수정 · QR" : ARTIST_LABEL[user.artistStatus] || "전시를 직접 등록하려면 인증이 필요합니다."}
          </p>
        </div>
        <Link href={approvedArtist || user.artistStatus === "PENDING" ? "/artist" : "/artist/apply"} className="text-xs underline underline-offset-4">
          {approvedArtist || user.artistStatus === "PENDING" ? "열기" : "신청"}
        </Link>
      </div>
      {user.role === "ADMIN" && (
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="font-medium text-sm">Admin</p>
            <p className="text-muted text-xs">사용자 · 전시 · 신고 관리</p>
          </div>
          <Link href="/admin" className="text-xs underline underline-offset-4">
            열기
          </Link>
        </div>
      )}

      <SectionTitle>Audio Settings</SectionTitle>
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="font-medium text-sm">STILL Ambience (Pink Noise)</p>
          <p className="text-muted text-xs">기본값 Off · 화면을 이동해도 유지됩니다.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={audio.ambience === "on"}
          disabled={!audio.ambienceSupported}
          onClick={() => void audio.toggleAmbience()}
          className={cx(
            "h-9 px-4 text-xs border border-ink disabled:opacity-40",
            audio.ambience === "on" ? "bg-ink text-paper" : "bg-paper text-ink",
          )}
        >
          {audio.ambience === "on" ? "On" : "Off"}
        </button>
      </div>
      {audio.ambience === "error" && audio.ambienceError && <Notice tone="error">{audio.ambienceError}</Notice>}

      <SectionTitle>Session</SectionTitle>
      <Button variant="secondary" full onClick={() => void logout()}>
        Logout
      </Button>

      <SectionTitle>Account Deletion</SectionTitle>
      <p className="text-muted text-xs mb-3">계정과 모든 Archive, 저장한 문장, Journal, 웹카드가 영구 삭제됩니다.</p>
      <Button variant="text" className="text-muted" onClick={() => setConfirm(true)}>
        계정 삭제
      </Button>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <Dialog
        open={confirm}
        title="계정을 삭제할까요?"
        confirmLabel="영구 삭제"
        onConfirm={() => void deleteAccount()}
        onCancel={() => setConfirm(false)}
        busy={busy}
        destructive
      >
        모든 개인 기록이 함께 삭제되며 복구할 수 없습니다. 같은 Google 계정으로 다시 로그인하면 새 계정이 만들어집니다.
      </Dialog>
    </div>
  );
}
