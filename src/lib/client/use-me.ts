"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { PublicUser } from "@/lib/api";
import { api } from "./fetcher";

/**
 * The current user's full profile (role, artist status…) from /api/users/me.
 * The JWT only carries the id; roles live in the DB so admin changes apply
 * immediately without re-login.
 */
export function useMe() {
  const { status } = useSession();
  const [me, setMe] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      setMe(null);
      setLoading(false);
      return;
    }
    let alive = true;
    api<{ user: PublicUser | null }>("/api/users/me")
      .then((d) => alive && setMe(d.user))
      .catch(() => alive && setMe(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [status]);

  const refresh = async () => {
    const d = await api<{ user: PublicUser | null }>("/api/users/me");
    setMe(d.user);
    return d.user;
  };

  return {
    me,
    loading: status === "loading" || loading,
    isAdmin: me?.role === "ADMIN",
    isArtist: me?.role === "ADMIN" || (me?.role === "ARTIST" && me?.artistStatus === "APPROVED"),
    refresh,
  };
}
