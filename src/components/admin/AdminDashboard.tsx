"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loading, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/fetcher";

type Stats = { users: number; pendingArtists: number; exhibitions: number; activeExhibitions: number; openReports: number; suspendedUsers: number };

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Stats>("/api/admin/stats").then(setStats).catch((e) => setError(errorMessage(e)));
  }, []);
  if (error) return <div className="px-5 pt-4"><Notice tone="error">{error}</Notice></div>;
  if (!stats) return <Loading />;

  const tile = (label: string, value: number, href: string, urgent?: boolean) => (
    <Link href={href} className={`border p-4 block ${urgent && value > 0 ? "border-ink" : "border-line"}`}>
      <p className="text-muted text-xs">{label}</p>
      <p className="font-display text-2xl mt-1">{value}</p>
    </Link>
  );

  return (
    <div className="px-5 pb-10 pt-4">
      <div className="grid grid-cols-2 gap-3">
        {tile("아티스트 승인 대기", stats.pendingArtists, "/admin/users?filter=pending", true)}
        {tile("미처리 신고", stats.openReports, "/admin/reports?status=OPEN", true)}
        {tile("사용자", stats.users, "/admin/users")}
        {tile("정지된 계정", stats.suspendedUsers, "/admin/users?filter=suspended")}
        {tile("전시 (전체)", stats.exhibitions, "/admin/exhibitions")}
        {tile("공개 중 전시", stats.activeExhibitions, "/admin/exhibitions?status=ACTIVE")}
      </div>
      <p className="text-muted text-xs mt-6 leading-5">
        관리자 권한은 <code>ADMIN_EMAILS</code>(.env)에 적힌 이메일로 로그인하면 자동 부여되며, Users 탭에서 다른 계정에 부여할 수도 있습니다.
      </p>
    </div>
  );
}
