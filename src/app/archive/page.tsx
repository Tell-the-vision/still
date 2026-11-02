import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { currentUser } from "@/lib/api";
import { listArchives } from "@/lib/archives";
import { loginUrl } from "@/lib/client/pending-action";
import { yearOf } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Archive" };

/** Screen 07 — My Archive Grid (logged-in only). */
export default async function ArchivePage() {
  const user = await currentUser();
  if (!user) redirect(loginUrl("/archive"));
  const rows = await listArchives(user.id);

  return (
    <main className="flex flex-col min-h-dvh">
      <PageHeader back="/" title="My Archive" right={<span className="text-xs text-muted">{rows.length}</span>} />
      <div className="flex-1 px-5 pb-8">
        {rows.length === 0 ? (
          <EmptyState
            title="아직 기록한 전시가 없습니다"
            body="전시장의 QR 코드를 스캔하면 이 전시가 Archive에 담깁니다."
            action={<LinkButton href="/scan">QR Scan</LinkButton>}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 pt-2">
            {rows.map((a) => (
              <li key={a.id}>
                <Link href={`/archive/${a.id}`} className="block">
                  {a.exhibition.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.exhibition.coverImageUrl} alt="" className="w-full aspect-[4/5] object-cover bg-line" />
                  ) : (
                    <div className="w-full aspect-[4/5] bg-line" aria-hidden />
                  )}
                  <p className="font-display text-sm mt-3 leading-snug">{a.exhibition.title}</p>
                  <p className="text-muted text-xs mt-1">
                    {a.exhibition.venue}
                    {yearOf(a.exhibition.startDate) ? ` · ${yearOf(a.exhibition.startDate)}` : ""}
                  </p>
                  <p className="text-muted text-xs mt-1">
                    문장 {a.scraps.length} · Journal {a.journal ? 1 : 0} · 카드 {a.keepsakes.length}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomNav active="archive" />
    </main>
  );
}
