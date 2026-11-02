import { Suspense } from "react";
import { AdminReports } from "@/components/admin/AdminReports";
import { Loading } from "@/components/ui";

export const metadata = { title: "Admin · Reports" };

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminReports />
    </Suspense>
  );
}
