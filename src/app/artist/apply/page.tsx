import { redirect } from "next/navigation";
import { ArtistApplyForm } from "@/components/artist/ArtistApplyForm";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { currentUser, isArtist, publicUser } from "@/lib/api";
import { loginUrl } from "@/lib/client/pending-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Artist Application" };

export default async function ArtistApplyPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const user = await currentUser();
  if (!user) redirect(loginUrl("/artist/apply") + "&as=artist");
  const { callbackUrl } = await searchParams;
  const next = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") && callbackUrl !== "/" ? callbackUrl : "/artist";

  if (isArtist(user)) redirect("/artist");

  return (
    <main>
      <PageHeader back="/artist" title="Artist" />
      {user.artistStatus === "PENDING" ? (
        <EmptyState title="이미 심사 중인 신청이 있습니다" body="관리자가 승인하면 전시를 등록할 수 있습니다." action={<LinkButton href={next} variant="secondary">계속하기</LinkButton>} />
      ) : (
        <ArtistApplyForm me={publicUser(user)} next="/artist" />
      )}
    </main>
  );
}
