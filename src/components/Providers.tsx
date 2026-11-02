"use client";

import { SessionProvider } from "next-auth/react";
import { AudioProvider } from "@/components/audio/AudioProvider";
import { SessionGuard } from "@/components/auth/SessionGuard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionGuard />
      <AudioProvider>{children}</AudioProvider>
    </SessionProvider>
  );
}
