import { QrScanner } from "@/components/QrScanner";
import { BottomNav, PageHeader } from "@/components/ui";

export const metadata = { title: "QR Scan" };

/** Screen 03 — QR Scanner (Figma 03). */
export default function ScanPage() {
  return (
    <main className="flex flex-col min-h-dvh">
      <PageHeader back="/" backLabel="Home" />
      <div className="flex-1">
        <QrScanner />
      </div>
      <BottomNav />
    </main>
  );
}
