import { Suspense } from "react";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { Loading } from "@/components/ui";
import { requireAdmin } from "@/lib/api";

export const metadata = { title: "Admin · Users" };

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  return (
    <Suspense fallback={<Loading />}>
      <AdminUsers meId={me.id} />
    </Suspense>
  );
}
