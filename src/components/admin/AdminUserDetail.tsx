"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STATUS_LABEL, Tag } from "@/components/admin/AdminShell";
import { Loading, Notice, SectionTitle } from "@/components/ui";
import type { PublicUser } from "@/lib/api";
import { api, errorMessage } from "@/lib/client/fetcher";
import { formatDateTime } from "@/lib/format";

type Detail = {
  user: PublicUser & { archiveCount: number };
  exhibitions: { id: string; slug: string; title: string; status: string; likeCount: number; openReportCount: number; updatedAt: string }[];
};

export function AdminUserDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Detail>(`/api/admin/users/${id}`).then(setD).catch((e) => setError(errorMessage(e)));
  }, [id]);
  if (error) return <div className="px-5 pt-4"><Notice tone="error">{error}</Notice></div>;
  if (!d) return <Loading />;
  const u = d.user;
  return (
    <div className="px-5 pb-10 pt-4">
      <p className="font-display text-lg">{u.displayName || "(이름 없음)"}</p>
      <p className="text-muted text-xs">{u.email}</p>
      <p className="text-xs mt-2 flex gap-1.5 flex-wrap">
        <Tag strong={u.role !== "USER"}>{STATUS_LABEL[u.role]}</Tag>
        {u.artistStatus !== "NONE" && <Tag>아티스트 {STATUS_LABEL[u.artistStatus]}</Tag>}
        {u.status === "SUSPENDED" && <Tag strong>정지</Tag>}
      </p>
      <dl className="text-xs text-muted mt-4 space-y-1">
        <div>가입 {formatDateTime(u.createdAt)} · Archive {u.archiveCount}개</div>
        {u.artistName && <div>아티스트 이름: <span className="text-ink">{u.artistName}</span></div>}
        {u.artistBio && <div className="whitespace-pre-wrap">{u.artistBio}</div>}
        {u.artistPortfolioUrl && (
          <div>
            <a href={u.artistPortfolioUrl} className="underline" target="_blank" rel="noopener noreferrer">
              {u.artistPortfolioUrl}
            </a>
          </div>
        )}
        {u.artistReviewNote && <div>심사 메모: {u.artistReviewNote}</div>}
        {u.suspendedReason && <div>정지 사유: {u.suspendedReason}</div>}
      </dl>
      <p className="mt-3 text-xs">
        <Link href={`/admin/users?q=${encodeURIComponent(u.email)}`} className="underline underline-offset-4">
          목록에서 관리 (승인·역할·정지)
        </Link>
      </p>

      <SectionTitle>Exhibitions ({d.exhibitions.length})</SectionTitle>
      {d.exhibitions.length === 0 ? (
        <p className="text-muted text-sm">등록한 전시가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line">
          {d.exhibitions.map((e) => (
            <li key={e.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/artist/exhibitions/${e.id}`} className="text-sm underline underline-offset-4 truncate block">
                  {e.title}
                </Link>
                <p className="text-muted text-xs">
                  /e/{e.slug} · ♥ {e.likeCount}
                  {e.openReportCount > 0 && ` · 미처리 신고 ${e.openReportCount}`}
                </p>
              </div>
              <Tag strong={e.status === "ACTIVE"}>{STATUS_LABEL[e.status]}</Tag>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
