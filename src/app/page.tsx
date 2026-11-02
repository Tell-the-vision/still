/**
 * Screen 01 / 02 — Home (logged out / logged in).
 * Entry point: STILL wordmark + Login + QR Scan. Logged-in users also get
 * My Archive (with count) and direct URL entry.
 */
import { eq, count } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { archives } from "@/db/schema";
import { UrlEntry } from "@/components/home/UrlEntry";
import { BottomNav, LinkButton, Wordmark } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <main className="flex flex-col min-h-dvh">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <h1>
            <Wordmark className="text-3xl" />
          </h1>
          <p className="text-muted text-xs tracking-widest mt-3">Art stays with you.</p>
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

  const [{ n }] = await db.select({ n: count() }).from(archives).where(eq(archives.userId, userId));
  const name = session.user.name?.trim();

  return (
    <main className="flex flex-col min-h-dvh">
      <div className="flex-1 px-8 pt-20">
        <h1 className="text-center">
          <Wordmark className="text-3xl" />
        </h1>
        <p className="text-muted text-xs tracking-widest mt-3 text-center">Art stays with you.</p>

        <section className="mt-16">
          <p className="text-sm text-muted">{name ? `${name}님의 기록` : "나의 기록"}</p>
          <LinkButton href="/archive" variant="secondary" full className="mt-3 justify-between px-5">
            <span>My Archive</span>
            <span className="text-muted">{n}</span>
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
      </div>
      <BottomNav active="home" />
    </main>
  );
}
