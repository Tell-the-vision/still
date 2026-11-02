import { QrScanner } from "@/components/QrScanner";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "QR Scan" };

/** Screen 03 — QR Scanner. */
export default function ScanPage() {
  return (
    <main>
      <PageHeader back="/" title="QR Scan" />
      <QrScanner />
    </main>
  );
}
