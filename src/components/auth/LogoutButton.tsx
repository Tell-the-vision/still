"use client";

import { signOut } from "next-auth/react";
import { useAudio } from "@/components/audio/AudioProvider";
import { cx } from "@/components/ui";

/** Text-style logout control (ACCOUNT-02). Stops the ambience and returns to Home. */
export function LogoutButton({ className = "" }: { className?: string }) {
  const audio = useAudio();
  return (
    <button
      type="button"
      className={cx("underline underline-offset-4", className)}
      onClick={() => {
        audio.ambienceOff();
        void signOut({ redirectTo: "/" });
      }}
    >
      Logout
    </button>
  );
}
