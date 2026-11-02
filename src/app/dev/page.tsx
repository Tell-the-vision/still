import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/ui";
import { exhibitionUrl, listExhibitions } from "@/lib/exhibitions";
import { periodLabel } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev — Exhibitions & QR" };

/**
 * Development helper (NOT a product screen): lists the seeded exhibitions
 * with their QR codes so the team can test the QR entry flow on a phone.
 * Print the QR or scan it straight off the screen.
 */
export default async function DevPage() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;
  const rows = await listExhibitions();

  return (
    <main>
      <PageHeader back="/" title="Dev · Exhibitions" />
      <div className="px-5 pb-10">
        <p className="text-muted text-xs mb-6">
          개발/데모용 페이지입니다. 각 QR은 <code>/e/&lt;slug&gt;</code>로 연결됩니다. 다른 기기에서 테스트하려면 <code>.env</code>의{" "}
          <code>NEXT_PUBLIC_APP_URL</code>을 이 서버의 외부 주소로 설정하세요.
        </p>
        <ul className="space-y-10">
          {rows.map((e) => {
            const url = exhibitionUrl(e.slug, origin);
            return (
              <li key={e.id} className="flex gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/exhibitions/${e.slug}/qr`} alt={`${e.title} QR`} width={120} height={120} className="shrink-0 border border-line" />
                <div className="min-w-0 text-sm">
                  <p className="font-display">{e.title}</p>
                  <p className="text-muted text-xs">
                    {e.venue} · {periodLabel(e.startDate, e.endDate)}
                  </p>
                  <p className="text-xs mt-2 break-all">
                    <Link href={`/e/${e.slug}`} className="underline underline-offset-4">
                      {url}
                    </Link>
                  </p>
                  <p className="text-muted text-xs mt-1">
                    <a href={`/api/exhibitions/${e.slug}/qr?format=png`} download className="underline underline-offset-4">
                      QR PNG 다운로드
                    </a>
                    {" · "}
                    <a href={`/api/exhibitions/${e.slug}/audio`} className="underline underline-offset-4">
                      audio.json
                    </a>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
