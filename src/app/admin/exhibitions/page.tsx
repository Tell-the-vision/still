import { Suspense } from "react";
import { AdminExhibitions } from "@/components/admin/AdminExhibitions";
import { Loading } from "@/components/ui";

export const metadata = { title: "Admin · Exhibitions" };

export default function AdminExhibitionsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminExhibitions />
    </Suspense>
  );
}
