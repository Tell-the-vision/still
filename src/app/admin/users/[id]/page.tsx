import { AdminUserDetail } from "@/components/admin/AdminUserDetail";

export const metadata = { title: "Admin · User" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminUserDetail id={id} />;
}
