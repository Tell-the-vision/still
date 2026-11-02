"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/exhibitions", label: "Exhibitions" },
  { href: "/admin/reports", label: "Reports" },
];

/** Admin console tab bar. Desktop-friendly width (admins are not on phones). */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="hairline flex overflow-x-auto" aria-label="Admin">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={cx("px-4 py-3 text-xs tracking-widest uppercase whitespace-nowrap", active ? "text-ink font-medium border-b border-ink" : "text-muted")} aria-current={active ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  ACTIVE: "공개",
  HIDDEN: "숨김",
  DELETED: "삭제",
  OPEN: "미처리",
  RESOLVED: "처리됨",
  DISMISSED: "기각",
  PENDING: "심사 중",
  APPROVED: "승인",
  REJECTED: "반려",
  NONE: "—",
  SUSPENDED: "정지",
  USER: "User",
  ARTIST: "Artist",
  ADMIN: "Admin",
};

export function Tag({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={cx("inline-block px-1.5 py-0.5 border text-[11px] leading-4", strong ? "border-ink" : "border-line text-muted")}>{children}</span>;
}
