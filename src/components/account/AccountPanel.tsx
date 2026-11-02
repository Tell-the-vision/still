"use client";

/**
 * Screen 09 — Account: Google user info, audio settings, Logout, Account Deletion.
 * TBD-08 (decided): deleting the account removes every archive and record.
 */
import { useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useAudio } from "@/components/audio/AudioProvider";
import { Dialog, Notice, SectionTitle, cx } from "@/components/ui";
import type { PublicUser } from "@/lib/api";
import { api, errorMessage } from "@/lib/client/fetcher";
import { formatDate } from "@/lib/format";

const ROLE_LABEL = { USER: "일반 사용자", ARTIST: "아티스트", ADMIN: "관리자" } as const;
const ARTIST_LABEL = { NONE: "", PENDING: "인증 심사 중", APPROVED: "인증 완료", REJECTED: "신청 반려" } as const;

export function AccountPanel({ user }: { user: PublicUser }) {
  const approvedArtist = user.role === "ADMIN" || (user.role === "ARTIST" && user.artistStatus === "APPROVED");
  const audio = useAudio();
  const { status: sessionStatus } = useSession();
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

  const row = "flex items-center justify-between gap-3 py-3 text-[14px]";

  return (
    <div className="px-6 pb-12">
      {/* Figma 09 — Account */}
      <header className="pt-6">
        <h1 className="screen-title">Account</h1>
      </header>

      <section className="mt-6">
        <p className="label">Signed in as</p>
        <div className="flex items-center gap-4 mt-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="w-12 h-12 rounded-full object-cover bg-placeholder" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-placeholder" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-[16px] font-medium truncate">{user.displayName || "—"}</p>
            <p className="text-muted text-[12px] truncate">{user.email}</p>
          </div>
        </div>
        <p className="label !normal-case !tracking-normal mt-3">
          가입 {formatDate(user.createdAt)} · {ROLE_LABEL[user.role]}
          {user.status === "SUSPENDED" ? " · 정지됨" : ""}
        </p>
        {user.status === "SUSPENDED" && (
          <div className="mt-3">
            <Notice tone="error">계정이 정지되었습니다.{user.suspendedReason ? ` 사유: ${user.suspendedReason}` : ""}</Notice>
          </div>
        )}
      </section>

      {/* Preferences — audio */}
      <SectionTitle>Preferences</SectionTitle>
      <button
        type="button"
        role="switch"
        aria-checked={audio.ambience === "on"}
        disabled={!audio.ambienceSupported}
        onClick={() => void audio.toggleAmbience()}
        className={cx(
          "w-full flex items-center justify-between gap-3 min-h-[46px] px-3.5 py-2.5 border border-ink text-left disabled:opacity-40",
          audio.ambience === "on" ? "bg-ink text-paper" : "bg-paper text-ink",
        )}
      >
        <span className="min-w-0">
          <span className="block text-[12px] font-medium uppercase tracking-[0.04em]">STILL Ambience · Pink Noise</span>
          <span className={cx("block text-[11px] mt-0.5", audio.ambience === "on" ? "text-paper/70" : "text-muted")}>
            기본값 Off · 화면을 이동해도 유지됩니다
          </span>
        </span>
        <span className="shrink-0 text-[12px] font-medium">{audio.ambience === "on" ? "ON" : "OFF"}</span>
      </button>
      {audio.ambience === "error" && audio.ambienceError && (
        <div className="mt-3">
          <Notice tone="error">{audio.ambienceError}</Notice>
        </div>
      )}

      {/* Studio — artist / admin entry points (not in Figma; same row style) */}
      <SectionTitle>Studio</SectionTitle>
      <Link href={approvedArtist || user.artistStatus === "PENDING" ? "/artist" : "/artist/apply"} className={row}>
        <span className="min-w-0">
          <span className="block">{approvedArtist ? "Artist Studio" : "아티스트 인증"}</span>
          <span className="block text-muted text-[12px] mt-0.5">
            {approvedArtist ? "내 전시 등록 · 수정 · QR" : ARTIST_LABEL[user.artistStatus] || "전시를 직접 등록하려면 인증이 필요합니다."}
          </span>
        </span>
        <span aria-hidden>→</span>
      </Link>
      {user.role === "ADMIN" && (
        <Link href="/admin" className={row}>
          <span className="min-w-0">
            <span className="block">Admin</span>
            <span className="block text-muted text-[12px] mt-0.5">사용자 · 전시 · 신고 관리</span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      {/* About */}
      <SectionTitle>About STILL</SectionTitle>
      <p className="font-display text-[20px] leading-7">Art stays with you.</p>
      <p className="text-muted text-[13px] leading-5 mt-1">A quiet place for what remains after the exhibition ends.</p>

      {/* Account */}
      <SectionTitle>Account</SectionTitle>
      <div className="flex flex-col items-start gap-4">
        <button
          type="button"
          onClick={() => void logout()}
          disabled={sessionStatus === "loading"}
          className="inline-flex gap-2 text-[14px] disabled:opacity-50"
        >
          <span>Log out</span>
          <span aria-hidden>→</span>
        </button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="inline-flex gap-2 text-[14px] text-muted hover:text-ink"
        >
          <span>Delete account</span>
          <span aria-hidden>→</span>
        </button>
        <p className="text-muted text-[11px] -mt-2">계정과 모든 Archive, 저장한 문장, Journal, 웹카드가 영구 삭제됩니다.</p>
      </div>
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
