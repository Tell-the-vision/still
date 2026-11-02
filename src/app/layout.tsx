import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: { default: "STILL", template: "%s · STILL" },
  description: "STILL — Art stays with you. 전시 경험을 기록하고 간직하는 개인 아카이브.",
  applicationName: "STILL",
  // Installable to the home screen (the PO's original idea was a mobile app;
  // the MVP is a mobile-first web app that behaves like one when installed).
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "STILL", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Fonts are loaded at runtime (no build-time fetch). Montserrat stands in for Futura. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app/layout applies to every route */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Montserrat:wght@300;400;500;600&family=Noto+Serif+KR:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <div className="app-frame">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
