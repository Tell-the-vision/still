import { Suspense } from "react";
import { notFound } from "next/navigation";
import { KeepsakeCreator } from "@/components/keepsake/KeepsakeCreator";
import { BottomNav, PageHeader } from "@/components/ui";
import { findExhibition } from "@/lib/exhibitions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Digital Keepsake" };

/** Screen 06 — Digital Keepsake creation. */
export default async function KeepsakeCreatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exhibition = await findExhibition(slug);
  if (!exhibition) notFound();
  return (
    <main className="flex flex-col min-h-dvh">
      <PageHeader back={`/e/${exhibition.slug}`} backLabel="Exhibition" title="Keepsake" />
      <Suspense>
        <KeepsakeCreator exhibition={exhibition} />
      </Suspense>
      <BottomNav />
    </main>
  );
}
