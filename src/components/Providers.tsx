"use client";

import { SessionProvider } from "next-auth/react";
import { AudioProvider } from "@/components/audio/AudioProvider";
import { SessionGuard } from "@/components/auth/SessionGuard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // refetchOnWindowFocus is off: every /api/auth/session call re-issues the
    // session cookie, and a late response can resurrect a cookie that a
    // concurrent logout just cleared. Roles are read from the DB anyway.
    <SessionProvider refetchOnWindowFocus={false}>
      <SessionGuard />
      <AudioProvider>{children}</AudioProvider>
    </SessionProvider>
  );
}
