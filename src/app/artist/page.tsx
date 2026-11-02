import { redirect } from "next/navigation";
import { ArtistDashboard } from "@/components/artist/ArtistDashboard";
import { BottomNav, PageHeader } from "@/components/ui";
import { currentUser, publicUser } from "@/lib/api";
import { loginUrl } from "@/lib/client/pending-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Artist" };

/** Artist studio home: verification status + my exhibitions. */
export default async function ArtistPage() {
  const user = await currentUser();
  if (!user) redirect(loginUrl("/artist") + "&as=artist");
  return (
    <main className="flex flex-col min-h-dvh">
      <PageHeader back="/" title="Artist Studio" />
      <div className="flex-1">
        <ArtistDashboard me={publicUser(user)} />
      </div>
      <BottomNav active="account" />
    </main>
  );
}
