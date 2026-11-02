import { Suspense } from "react";
import { notFound } from "next/navigation";
import { JournalEditor } from "@/components/journal/JournalEditor";
import { PageHeader } from "@/components/ui";
import { findExhibition } from "@/lib/exhibitions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal" };

/** Screen 05 — Journal (guests may write; saving asks for login). */
export default async function JournalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exhibition = await findExhibition(slug);
  if (!exhibition || exhibition.status !== "ACTIVE") notFound();
  return (
    <main>
      <PageHeader back={`/e/${exhibition.slug}`} title="Journal" />
      <Suspense>
        <JournalEditor exhibition={exhibition} />
      </Suspense>
    </main>
  );
}
