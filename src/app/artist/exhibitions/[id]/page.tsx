import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { exhibitions } from "@/db/schema";
import { ExhibitionEditor } from "@/components/artist/ExhibitionEditor";
import { PageHeader } from "@/components/ui";
import { currentUser, isAdmin } from "@/lib/api";
import { canManageExhibition } from "@/lib/artist";
import { loginUrl } from "@/lib/client/pending-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Exhibition" };

/** Exhibition editor — owner artist, or an admin (from /admin/exhibitions). */
export default async function EditExhibitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(loginUrl(`/artist/exhibitions/${id}`));
  const ex = await db.query.exhibitions.findFirst({ where: eq(exhibitions.id, id), columns: { id: true, ownerId: true, status: true } });
  if (!ex || ex.status === "DELETED" || !canManageExhibition(user, ex)) notFound();
  const back = isAdmin(user) && ex.ownerId !== user.id ? "/admin/exhibitions" : "/artist";
  return (
    <main>
      <PageHeader back={back} title="Edit Exhibition" />
      <ExhibitionEditor exhibitionId={id} backHref={back} />
    </main>
  );
}
