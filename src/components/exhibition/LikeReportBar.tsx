"use client";

/**
 * 좋아요 / 신고 for an exhibition. Both need login; a guest is sent to
 * /login and the action resumes afterwards (like → applied, report → dialog reopens).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button, Dialog, Notice, cx } from "@/components/ui";
import { track } from "@/lib/client/analytics";
import { api, errorMessage } from "@/lib/client/fetcher";
import { consumePendingAction } from "@/lib/client/pending-action";
import { useRequireLogin } from "@/lib/client/use-require-login";

const REASONS: { value: string; label: string }[] = [
  { value: "INAPPROPRIATE", label: "부적절한 콘텐츠" },
  { value: "COPYRIGHT", label: "저작권 침해" },
  { value: "SPAM", label: "스팸 / 광고" },
  { value: "OTHER", label: "기타" },
];

export function LikeReportBar({
  exhibitionId,
  exhibitionSlug,
  isOwner,
  disabled,
}: {
  exhibitionId: string;
  exhibitionSlug: string;
  isOwner?: boolean;
  disabled?: boolean;
}) {
  const { status } = useSession();
  const { requireLogin, isLoggedIn } = useRequireLogin();
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("INAPPROPRIATE");
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const resumedRef = useRef(false);

  useEffect(() => {
    if (status === "loading" || disabled) return;
    let alive = true;
    api<{ count: number; liked: boolean }>(`/api/exhibitions/${exhibitionId}/like`)
      .then((d) => {
        if (!alive) return;
        setCount(d.count);
        setLiked(d.liked);
      })
      .catch(() => {});
    if (status === "authenticated") {
      api<{ reported: boolean }>(`/api/exhibitions/${exhibitionId}/reports`)
        .then((d) => alive && setReported(d.reported))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [status, exhibitionId, disabled]);

  const toggleLike = useCallback(async () => {
    if (!requireLogin({ type: "like", exhibitionSlug })) return;
    setBusy(true);
    setError(null);
    try {
      if (liked) {
        await api(`/api/exhibitions/${exhibitionId}/like`, { method: "DELETE" });
        setLiked(false);
        setCount((c) => Math.max(0, (c ?? 1) - 1));
        track("exhibition_unlike", { exhibition_id: exhibitionId });
      } else {
        const d = await api<{ count: number; liked: boolean }>(`/api/exhibitions/${exhibitionId}/like`, { method: "POST" });
        setLiked(d.liked);
        setCount(d.count);
        track("exhibition_like", { exhibition_id: exhibitionId });
      }
    } catch (err) {
      setError(errorMessage(err, "좋아요를 처리하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }, [exhibitionId, exhibitionSlug, liked, requireLogin]);

  // Resume after login
  useEffect(() => {
    if (status !== "authenticated" || resumedRef.current || disabled) return;
    const like = consumePendingAction("like", exhibitionSlug);
    if (like) {
      resumedRef.current = true;
      if (!liked) void toggleLike();
      return;
    }
    const report = consumePendingAction("report", exhibitionSlug);
    if (report) {
      resumedRef.current = true;
      setOpen(true);
    }
  }, [status, exhibitionSlug, liked, toggleLike, disabled]);

  const openReport = () => {
    if (!requireLogin({ type: "report", exhibitionSlug })) return;
    setOpen(true);
  };

  const submitReport = async () => {
    setSending(true);
    setError(null);
    try {
      const d = await api<{ created: boolean }>(`/api/exhibitions/${exhibitionId}/reports`, {
        method: "POST",
        body: { reason, detail },
      });
      setReported(true);
      setOpen(false);
      setDetail("");
      setNotice(d.created ? "신고가 접수되었습니다. 관리자가 확인한 뒤 조치합니다." : "이미 접수된 신고가 있습니다.");
      track("exhibition_report", { exhibition_id: exhibitionId, reason });
    } catch (err) {
      setError(errorMessage(err, "신고를 접수하지 못했습니다."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => void toggleLike()}
          disabled={busy || disabled}
          aria-pressed={liked}
          aria-label={liked ? "좋아요 취소" : "좋아요"}
          className={cx(
            "h-10 px-4 border text-sm inline-flex items-center gap-2 disabled:opacity-40",
            liked ? "bg-ink text-paper border-ink" : "border-ink text-ink",
          )}
        >
          <span aria-hidden>{liked ? "♥" : "♡"}</span>
          <span>{count ?? "–"}</span>
        </button>

        {!isOwner && (
          <button
            type="button"
            onClick={openReport}
            disabled={disabled || reported}
            className="text-xs text-muted underline underline-offset-4 disabled:no-underline disabled:opacity-60"
          >
            {reported ? "신고 접수됨" : "신고하기"}
          </button>
        )}
      </div>
      {!isLoggedIn && <p className="text-muted text-xs mt-2">좋아요와 신고는 로그인 후 이용할 수 있습니다.</p>}
      {notice && (
        <div className="mt-3">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
      {error && !open && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <Dialog
        open={open}
        title="이 전시를 신고할까요?"
        confirmLabel="신고 접수"
        onConfirm={() => void submitReport()}
        onCancel={() => setOpen(false)}
        busy={sending}
      >
        <div className="space-y-3 text-ink">
          <div role="radiogroup" aria-label="신고 사유" className="space-y-2">
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                {r.label}
              </label>
            ))}
          </div>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value.slice(0, 500))}
            rows={3}
            placeholder={reason === "OTHER" ? "사유를 적어 주세요 (필수)" : "상세 내용 (선택)"}
            className="w-full text-sm border-b border-line py-2 resize-none"
            aria-label="신고 상세"
          />
          {error && <Notice tone="error">{error}</Notice>}
          <p className="text-muted text-xs">신고 내용은 관리자에게만 전달됩니다.</p>
        </div>
      </Dialog>
      <span className="sr-only">
        <Button variant="text" onClick={() => setNotice(null)}>
          알림 닫기
        </Button>
      </span>
    </div>
  );
}
