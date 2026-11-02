import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { digitalKeepsakes } from "@/db/schema";
import { KeepsakeViewer } from "@/components/keepsake/KeepsakeViewer";
import { PageHeader } from "@/components/ui";
import { currentUser } from "@/lib/api";
import { loginUrl } from "@/lib/client/pending-action";
import { parseKeepsakeContent } from "@/lib/keepsake-templates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Keepsake" };

/** Saved web card — re-open, PNG download (owner only). */
export default async function KeepsakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(loginUrl(`/keepsake/${id}`));

  const row = await db.query.digitalKeepsakes.findFirst({
    where: eq(digitalKeepsakes.id, id),
    with: { archive: { columns: { userId: true } } },
  });
  if (!row || row.archive.userId !== user.id) notFound();

  return (
    <main>
      <PageHeader back={`/archive/${row.archiveId}`} title="Keepsake" />
      <KeepsakeViewer
        keepsake={{
          id: row.id,
          archiveId: row.archiveId,
          templateId: row.templateId,
          content: parseKeepsakeContent(row.contentData),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }}
      />
    </main>
  );
}
