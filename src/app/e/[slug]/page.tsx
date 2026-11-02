import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExhibitionGuide } from "@/components/exhibition/ExhibitionGuide";
import { PageHeader, Wordmark } from "@/components/ui";
import { findExhibition, getGuide, groupGuide } from "@/lib/exhibitions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ex = await findExhibition(slug);
  return { title: ex ? ex.title : "Exhibition" };
}

/** Screen 04 — Exhibition Guide (QR / URL target: /e/<slug>). Public. */
export default async function ExhibitionPage({ params }: Props) {
  const { slug } = await params;
  const exhibition = await findExhibition(slug);
  if (!exhibition || exhibition.status !== "ACTIVE") notFound();
  const sentences = await getGuide(exhibition.id);

  return (
    <main>
      <PageHeader back="/" title={<Wordmark />} />
      <Suspense>
        <ExhibitionGuide exhibition={exhibition} sections={groupGuide(sentences)} />
      </Suspense>
    </main>
  );
}
