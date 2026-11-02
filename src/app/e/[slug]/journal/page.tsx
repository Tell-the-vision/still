import { Suspense } from "react";
import { notFound } from "next/navigation";
import { JournalEditor } from "@/components/journal/JournalEditor";
import { BottomNav, PageHeader } from "@/components/ui";
import { findExhibition } from "@/lib/exhibitions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal" };

/** Screen 05 — Journal (guests may write; saving asks for login). */
export default async function JournalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exhibition = await findExhibition(slug);
  if (!exhibition) notFound();
  return (
    <main className="flex flex-col min-h-dvh">
      <PageHeader back={`/e/${exhibition.slug}`} backLabel="Exhibition" title="Journal" />
      <Suspense>
        <JournalEditor exhibition={exhibition} />
      </Suspense>
      <BottomNav />
    </main>
  );
}
