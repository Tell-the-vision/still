import { redirect } from "next/navigation";
import { ExhibitionEditor } from "@/components/artist/ExhibitionEditor";
import { PageHeader } from "@/components/ui";
import { currentUser, isArtist } from "@/lib/api";
import { loginUrl } from "@/lib/client/pending-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Exhibition" };

export default async function NewExhibitionPage() {
  const user = await currentUser();
  if (!user) redirect(loginUrl("/artist/exhibitions/new") + "&as=artist");
  if (!isArtist(user)) redirect("/artist");
  return (
    <main>
      <PageHeader back="/artist" title="New Exhibition" />
      <ExhibitionEditor />
    </main>
  );
}
