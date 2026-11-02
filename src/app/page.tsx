/**
 * Screen 01 / 02 — Home (logged out / logged in).
 * Entry point: STILL wordmark + Login + QR Scan. Logged-in users also get
 * My Archive (with count), direct URL entry, and links to Artist Studio /
 * Admin depending on their role.
 *
 * "Logged in" means the session resolves to a real user row — a stale
 * cookie (user deleted / DB reset) renders the logged-out home and the
 * SessionGuard clears it.
 */
import { eq, count } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { archives } from "@/db/schema";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { UrlEntry } from "@/components/home/UrlEntry";
import { BottomNav, LinkButton, Notice, Wordmark } from "@/components/ui";
import { currentUser, isAdmin, isArtist } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const me = await currentUser();
  const { session: sessionFlag } = await searchParams;

  if (!me) {
    return (
      <main className="flex flex-col min-h-dvh">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <h1>
            <Wordmark className="text-3xl" />
          </h1>
          <p className="text-muted text-xs tracking-widest mt-3">Art stays with you.</p>
          {sessionFlag === "expired" && (
            <div className="mt-8 w-full">
              <Notice>세션이 만료되어 로그아웃되었습니다. 다시 로그인해 주세요.</Notice>
            </div>
          )}
        </div>
        <div className="px-8 pb-16 space-y-3">
          <LinkButton href="/login" full>
            Login
          </LinkButton>
          <LinkButton href="/scan" variant="secondary" full>
            QR Scan
          </LinkButton>
        </div>
      </main>
    );
  }

  const [{ n }] = await db.select({ n: count() }).from(archives).where(eq(archives.userId, me.id));
  const name = me.displayName?.trim();
  const artistHref = isArtist(me) || me.artistStatus === "PENDING" || me.artistStatus === "REJECTED" ? "/artist" : "/artist/apply";
  const artistLabel = isArtist(me)
    ? "Artist Studio"
    : me.artistStatus === "PENDING"
      ? "Artist Studio · 승인 대기"
      : me.artistStatus === "REJECTED"
        ? "Artist Studio · 반려됨"
        : "아티스트 인증 신청";

  return (
    <main className="flex flex-col min-h-dvh">
      <div className="flex-1 px-8 pt-16 pb-8">
        <h1 className="text-center">
          <Wordmark className="text-3xl" />
        </h1>
        <p className="text-muted text-xs tracking-widest mt-3 text-center">Art stays with you.</p>

        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted">{name ? `${name}님의 기록` : "나의 기록"}</p>
            <LogoutButton className="text-xs text-muted" />
          </div>
          <LinkButton href="/archive" variant="secondary" full className="mt-3 px-5">
            <span className="w-full flex items-center justify-between">
              <span>My Archive</span>
              <span className="text-muted">{n}</span>
            </span>
          </LinkButton>
        </section>

        <section className="mt-10">
          <LinkButton href="/scan" full>
            QR Scan
          </LinkButton>
          <div className="mt-6">
            <UrlEntry />
          </div>
        </section>

        {/* Role-specific entry points (PRD IA keeps global nav minimal, so these are text links). */}
        <section className="mt-10 hairline pt-5 text-sm">
          <Link href={artistHref} className="flex items-center justify-between py-3">
            <span>{artistLabel}</span>
            <span className="text-muted">→</span>
          </Link>
          {isAdmin(me) && (
            <Link href="/admin" className="flex items-center justify-between py-3">
              <span>Admin</span>
              <span className="text-muted">→</span>
            </Link>
          )}
          <Link href="/account" className="flex items-center justify-between py-3">
            <span>Account</span>
            <span className="text-muted">→</span>
          </Link>
        </section>

        {me.status === "SUSPENDED" && (
          <p className="mt-6 text-xs text-center text-muted">
            계정이 정지되어 기록 저장이 제한됩니다.{me.suspendedReason ? ` 사유: ${me.suspendedReason}` : ""}
          </p>
        )}
      </div>
      <BottomNav active="home" />
    </main>
  );
}
