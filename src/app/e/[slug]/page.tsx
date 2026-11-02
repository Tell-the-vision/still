import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExhibitionGuide } from "@/components/exhibition/ExhibitionGuide";
import { BottomNav, PageHeader } from "@/components/ui";
import { currentUser } from "@/lib/api";
import { canManageExhibition } from "@/lib/artist";
import { findExhibitionAny, getGuide, groupGuide, isPubliclyVisible } from "@/lib/exhibitions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ex = await findExhibitionAny(slug);
  return { title: ex ? ex.title : "Exhibition" };
}

/**
 * Screen 04 — Exhibition Guide (QR / URL target: /e/<slug>). Public.
 * Non-public exhibitions (draft / hidden / suspended artist) are shown only
 * to their owner or an admin, in preview mode.
 */
export default async function ExhibitionPage({ params }: Props) {
  const { slug } = await params;
  const row = await findExhibitionAny(slug);
  if (!row) notFound();

  const visible = isPubliclyVisible(row, row.owner);
  const user = await currentUser();
  const canManage = user ? canManageExhibition(user, row) : false;
  if (!visible && !canManage) notFound();

  const { owner: _owner, ...exhibition } = row;
  void _owner;
  const sentences = await getGuide(exhibition.id);

  return (
    <main className="flex flex-col min-h-dvh">
      {canManage && !visible ? (
        <PageHeader back={`/artist/exhibitions/${exhibition.id}`} backLabel="Editor" title="Preview" />
      ) : (
        <PageHeader />
      )}
      <Suspense>
        <ExhibitionGuide
          exhibition={exhibition}
          sections={groupGuide(sentences)}
          preview={!visible}
          isOwner={Boolean(user && exhibition.ownerId === user.id)}
        />
      </Suspense>
      <BottomNav />
    </main>
  );
}
