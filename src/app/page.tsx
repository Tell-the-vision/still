/**
 * Screen 01 / 02 — Home (logged out / logged in).
 * Entry point: STILL wordmark + Login + QR Scan. Logged-in users also get
 * their most recent exhibition, My Archive (with count), direct URL entry,
 * and links to Artist Studio / Admin depending on their role.
 *
 * "Logged in" means the session resolves to a real user row — a stale
 * cookie (user deleted / DB reset) renders the logged-out home and the
 * SessionGuard clears it.
 */
import Link from "next/link";
import { googleEnabled } from "@/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { UrlEntry } from "@/components/home/UrlEntry";
import { ArrowLink, Artwork, BottomNav, LinkButton, Notice, PageHeader, Wordmark } from "@/components/ui";
import { currentUser, isAdmin, isArtist } from "@/lib/api";
import { listArchives } from "@/lib/archives";
import { periodLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const me = await currentUser();
  const { session: sessionFlag } = await searchParams;

  if (!me) {
    // Figma 01 — Home / Logged Out
    return (
      <main className="flex flex-col min-h-dvh px-6">
        <div className="flex-1 flex flex-col items-center justify-center pb-10">
          <h1 className="text-[30px] leading-10">
            <Wordmark />
          </h1>
          <p className="label mt-3">Art stays with you.</p>

          <nav className="mt-24 flex flex-col gap-10 items-start" aria-label="시작하기">
            <Link href="/login" className="inline-flex items-center gap-[11px] font-display text-[20px] leading-7">
              <span className="w-5 h-5 bg-ink shrink-0" aria-hidden />
              {googleEnabled ? "Continue with Google" : "Log in"}
            </Link>
            <Link href="/scan" className="inline-flex items-center gap-2.5 font-display text-[20px] leading-7">
              <span className="w-[22px] h-[22px] rounded-full bg-ink shrink-0" aria-hidden />
              Scan Exhibition QR
            </Link>
          </nav>

          {sessionFlag === "expired" && (
            <div className="mt-10 w-full">
              <Notice>세션이 만료되어 로그아웃되었습니다. 다시 로그인해 주세요.</Notice>
            </div>
          )}
        </div>
        <p className="label text-center pb-8">
          전시 가이드는 로그인 없이 볼 수 있어요
        </p>
      </main>
    );
  }

  // Figma 02 — Home / Logged In
  const rows = await listArchives(me.id);
  const recent = rows[0];
  const n = rows.length;
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
      <PageHeader />
      <div className="flex-1 px-6 pb-10">
        <div className="pt-9">
          {name && <p className="label mb-2">{name}</p>}
          <h1 className="screen-title">Welcome back.</h1>
          <p className="text-muted text-[13px] leading-5 mt-1">Your experiences, kept in one place.</p>
        </div>

        {/* Continue exploring — most recently visited exhibition */}
        <section className="mt-10">
          <h2 className="label mb-3">Continue Exploring</h2>
          {recent ? (
            <>
              <Link href={`/e/${recent.exhibition.slug}`} className="block">
                <Artwork src={recent.exhibition.coverImageUrl} caption="Current Exhibition" />
                <p className="font-display text-[22px] leading-7 mt-5">{recent.exhibition.title}</p>
              </Link>
              <p className="text-muted text-[12px] leading-4 mt-1">
                {[recent.exhibition.venue, periodLabel(recent.exhibition.startDate, recent.exhibition.endDate)]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
              <LinkButton href={`/e/${recent.exhibition.slug}`} full className="mt-5">
                Open Exhibition Guide
              </LinkButton>
            </>
          ) : (
            <>
              <Artwork caption="Your next exhibition" />
              <p className="text-muted text-[13px] leading-5 mt-4">
                전시장의 QR 코드를 스캔하면 이곳에서 바로 이어 볼 수 있어요.
              </p>
              <LinkButton href="/scan" full className="mt-5">
                Scan Exhibition QR
              </LinkButton>
            </>
          )}
        </section>

        {/* Your archive */}
        <section className="hairline mt-10 pt-6">
          <h2 className="label">Your Archive</h2>
          <div className="flex items-end justify-between mt-1">
            <Link href="/archive" className="flex items-baseline gap-3">
              <span className="font-display text-[40px] leading-[1.2]">{String(n).padStart(2, "0")}</span>
              <span className="text-muted text-[13px]">saved exhibitions</span>
            </Link>
            <ArrowLink href="/archive" className="text-[12px] pb-3">
              View all
            </ArrowLink>
          </div>
        </section>

        {/* Enter another exhibition */}
        <section className="hairline mt-8 pt-6">
          <h2 className="label mb-4">Enter an Exhibition</h2>
          <LinkButton href="/scan" variant="secondary" full>
            Scan Exhibition QR
          </LinkButton>
          <div className="mt-6">
            <UrlEntry />
          </div>
        </section>

        {/* Role-specific entry points */}
        <section className="hairline mt-10 pt-2">
          <Link href={artistHref} className="flex items-center justify-between py-4 text-[14px]">
            <span>{artistLabel}</span>
            <span aria-hidden>→</span>
          </Link>
          {isAdmin(me) && (
            <Link href="/admin" className="flex items-center justify-between py-4 text-[14px]">
              <span>Admin</span>
              <span aria-hidden>→</span>
            </Link>
          )}
          <div className="flex items-center justify-between py-4">
            <span className="text-muted text-[12px] truncate">{me.email}</span>
            <LogoutButton className="label hover:text-ink shrink-0" />
          </div>
        </section>

        {me.status === "SUSPENDED" && (
          <p className="mt-4 text-[12px] text-muted">
            계정이 정지되어 기록 저장이 제한됩니다.{me.suspendedReason ? ` 사유: ${me.suspendedReason}` : ""}
          </p>
        )}
      </div>
      <BottomNav active="home" />
    </main>
  );
}
