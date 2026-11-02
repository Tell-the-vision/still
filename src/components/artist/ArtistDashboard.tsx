"use client";

/** /artist — verification status + my exhibitions. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, LinkButton, Loading, Notice, SectionTitle, cx } from "@/components/ui";
import type { PublicUser } from "@/lib/api";
import { api, errorMessage } from "@/lib/client/fetcher";
import { formatDateTime, yearOf } from "@/lib/format";

type Row = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  startDate: string | null;
  coverImageUrl: string | null;
  status: "DRAFT" | "ACTIVE" | "HIDDEN" | "DELETED";
  updatedAt: string;
  likeCount: number;
  openReportCount: number;
  archiveCount: number;
};

const STATUS_LABEL = { DRAFT: "비공개 초안", ACTIVE: "공개 중", HIDDEN: "관리자 숨김", DELETED: "삭제됨" } as const;

export function ArtistDashboard({ me }: { me: PublicUser }) {
  const approved = me.role === "ADMIN" || (me.role === "ARTIST" && me.artistStatus === "APPROVED");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!approved) return;
    api<{ exhibitions: Row[] }>("/api/artist/exhibitions")
      .then((d) => setRows(d.exhibitions))
      .catch((err) => setError(errorMessage(err)));
  }, [approved]);

  return (
    <div className="px-5 pb-10">
      <SectionTitle>Artist</SectionTitle>
      <p className="font-display text-lg">{me.artistName || me.displayName}</p>
      <p className="text-muted text-xs mt-1">{me.email}</p>

      {me.status === "SUSPENDED" && (
        <div className="mt-4">
          <Notice tone="error">계정이 정지되었습니다.{me.suspendedReason ? ` 사유: ${me.suspendedReason}` : ""} 전시가 방문자에게 보이지 않습니다.</Notice>
        </div>
      )}

      {!approved && me.artistStatus === "NONE" && (
        <EmptyState
          title="아직 아티스트 인증을 신청하지 않았습니다"
          body="인증 후 전시를 등록하고 QR을 받을 수 있습니다."
          action={<LinkButton href="/artist/apply">아티스트 인증 신청</LinkButton>}
        />
      )}
      {!approved && me.artistStatus === "PENDING" && (
        <EmptyState
          title="인증 심사 중입니다"
          body={`신청 ${formatDateTime(me.artistAppliedAt)} · 관리자가 승인하면 전시를 등록할 수 있습니다.`}
        />
      )}
      {!approved && me.artistStatus === "REJECTED" && (
        <EmptyState
          title="신청이 반려되었습니다"
          body={me.artistReviewNote ? `사유: ${me.artistReviewNote}` : undefined}
          action={<LinkButton href="/artist/apply" variant="secondary">다시 신청</LinkButton>}
        />
      )}

      {approved && (
        <>
          <SectionTitle right={<Link href="/artist/exhibitions/new" className="text-xs underline underline-offset-4">+ 새 전시</Link>}>My Exhibitions</SectionTitle>
          {error && <Notice tone="error">{error}</Notice>}
          {rows === null && !error && <Loading />}
          {rows && rows.length === 0 && (
            <EmptyState title="등록한 전시가 없습니다" body="첫 전시를 만들고 해설 가이드를 작성해 보세요." action={<LinkButton href="/artist/exhibitions/new">새 전시 만들기</LinkButton>} />
          )}
          {rows && rows.length > 0 && (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/artist/exhibitions/${r.id}`} className="flex gap-3 py-4">
                    {r.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverImageUrl} alt="" className="w-16 h-20 object-cover bg-line shrink-0" />
                    ) : (
                      <div className="w-16 h-20 bg-line shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm truncate">{r.title}</p>
                      <p className="text-muted text-xs mt-1 truncate">
                        {r.venue}
                        {yearOf(r.startDate) ? ` · ${yearOf(r.startDate)}` : ""}
                      </p>
                      <p className="text-xs mt-2 flex items-center gap-2 flex-wrap">
                        <span className={cx("px-1.5 py-0.5 border", r.status === "ACTIVE" ? "border-ink" : "border-line text-muted")}>{STATUS_LABEL[r.status]}</span>
                        <span className="text-muted">♥ {r.likeCount}</span>
                        <span className="text-muted">방문자 {r.archiveCount}</span>
                        {r.openReportCount > 0 && <span className="text-muted">신고 {r.openReportCount}</span>}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
