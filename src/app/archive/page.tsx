import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { currentUser } from "@/lib/api";
import { listArchives } from "@/lib/archives";
import { loginUrl } from "@/lib/client/pending-action";
import { yearOf } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Archive" };

/** Screen 07 — My Archive Grid (logged-in only). Figma 07. */
export default async function ArchivePage() {
  const user = await currentUser();
  if (!user) redirect(loginUrl("/archive"));
  const rows = await listArchives(user.id);

  return (
    <main className="flex flex-col min-h-dvh">
      <PageHeader />
      <div className="flex-1 px-6 pb-12">
        <header className="pt-6">
          <h1 className="screen-title">My Archive</h1>
          <p className="label mt-1.5">
            {String(rows.length).padStart(2, "0")} {rows.length === 1 ? "Experience" : "Experiences"}
          </p>
        </header>

        {rows.length === 0 ? (
          <EmptyState
            title="아직 기록한 전시가 없습니다"
            body="전시장의 QR 코드를 스캔하면 이 전시가 Archive에 담깁니다."
            action={<LinkButton href="/scan">Scan Exhibition QR</LinkButton>}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-4 mt-8">
            {rows.map((a) => {
              const place = [a.exhibition.venue, yearOf(a.exhibition.startDate)].filter(Boolean).join(" · ");
              return (
                <li key={a.id}>
                  <Link href={`/archive/${a.id}`} className="block h-full border border-ink p-2">
                    <div className="relative w-full aspect-square bg-placeholder overflow-hidden">
                      {a.exhibition.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.exhibition.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-[12%] bg-ink flex items-center justify-center" aria-hidden>
                          <div className="bg-paper h-[68%] w-[32%]" />
                        </div>
                      )}
                    </div>
                    <div className="px-1 pt-3 pb-1">
                      <p className="text-[15px] leading-5 break-keep">{a.exhibition.title}</p>
                      {place && <p className="label !text-[9px] mt-2 truncate">{place}</p>}
                      <p className="text-muted text-[11px] mt-1">
                        문장 {a.scraps.length} · Journal {a.journal ? 1 : 0} · 카드 {a.keepsakes.length}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <BottomNav active="archive" />
    </main>
  );
}
