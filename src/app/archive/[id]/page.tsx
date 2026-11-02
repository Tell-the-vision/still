import { notFound, redirect } from "next/navigation";
import { ArchiveDetail } from "@/components/archive/ArchiveDetail";
import { PageHeader } from "@/components/ui";
import { currentUser } from "@/lib/api";
import { getArchiveDetail } from "@/lib/archives";
import { loginUrl } from "@/lib/client/pending-action";
import { parseKeepsakeContent } from "@/lib/keepsake-templates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Archive" };

/** Screen 08 — Archive Detail (owner only). */
export default async function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(loginUrl(`/archive/${id}`));
  const detail = await getArchiveDetail(id);
  if (!detail || detail.userId !== user.id) notFound();

  return (
    <main>
      <PageHeader back="/archive" title="Archive" />
      <ArchiveDetail
        archive={{
          id: detail.id,
          exhibitionId: detail.exhibitionId,
          firstVisitedAt: detail.firstVisitedAt,
          lastVisitedAt: detail.lastVisitedAt,
          exhibition: detail.exhibition,
          scraps: detail.scraps,
          journal: detail.journal ?? null,
          keepsakes: detail.keepsakes.map((k) => ({
            id: k.id,
            templateId: k.templateId,
            content: parseKeepsakeContent(k.contentData),
            createdAt: k.createdAt,
          })),
        }}
      />
    </main>
  );
}
