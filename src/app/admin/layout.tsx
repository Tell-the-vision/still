import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/ui";
import { currentUser, isAdmin } from "@/lib/api";
import { loginUrl } from "@/lib/client/pending-action";

export const dynamic = "force-dynamic";

/** Every /admin/* page: must be logged in as ADMIN (others get a 404). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect(loginUrl("/admin"));
  if (!isAdmin(user)) notFound();
  return (
    <main className="min-h-dvh">
      <PageHeader back="/" title="Admin" />
      <AdminNav />
      {children}
    </main>
  );
}
