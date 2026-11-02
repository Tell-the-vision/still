"use client";

import { signOut, useSession } from "next-auth/react";
import { useAudio } from "@/components/audio/AudioProvider";
import { cx } from "@/components/ui";

/** Text-style logout control (ACCOUNT-02). Stops the ambience and returns to Home. */
export function LogoutButton({ className = "" }: { className?: string }) {
  const audio = useAudio();
  // Wait for any in-flight session fetch before signing out (see Providers.tsx).
  const { status } = useSession();
  return (
    <button
      type="button"
      className={cx("underline underline-offset-4 disabled:opacity-50", className)}
      disabled={status === "loading"}
      onClick={() => {
        audio.ambienceOff();
        void signOut({ redirectTo: "/" });
      }}
    >
      Logout
    </button>
  );
}
