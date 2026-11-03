import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";
import { useMe } from "../auth/use-me";

// "Saved · HH:MM" for a journal saved today, "Saved · d MMM" for an earlier day.
export function formatSavedAt(updatedAt: string, now = new Date()) {
  const at = new Date(updatedAt);
  if (at.toDateString() === now.toDateString())
    return `Saved · ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
  return `Saved · ${at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

// Derived from the saved journal itself, for the signed-in user only; null for guests or no journal.
export function useSavedLabel(code: string): string | null {
  const trpc = useTRPC();
  const me = useMe();
  const { data: journal } = useQuery(trpc.journal.get.queryOptions({ code }, { enabled: !!me }));
  return me && journal ? formatSavedAt(journal.updatedAt) : null;
}
