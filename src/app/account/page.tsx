import { redirect } from "next/navigation";
import { AccountPanel } from "@/components/account/AccountPanel";
import { BottomNav, PageHeader } from "@/components/ui";
import { currentUser } from "@/lib/api";
import { loginUrl } from "@/lib/client/pending-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

/** Screen 09 — Account. */
export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect(loginUrl("/account"));
  return (
    <main className="flex flex-col min-h-dvh">
      <PageHeader back="/" title="Account" />
      <div className="flex-1">
        <AccountPanel user={{ email: user.email, displayName: user.displayName, image: user.image, createdAt: user.createdAt }} />
      </div>
      <BottomNav active="account" />
    </main>
  );
}
