import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { templateDefaults } from "@still/shared/keepsake";
import { useTRPC } from "../../lib/trpc";
import { useMe } from "../auth/use-me";
import { keepsakeQueryOptions } from "./keepsakeQuery";

type Exhibition = {
  title: string;
  venue: { name: string; city: string };
  startDate: string;
  endDate: string;
  coverImage: { url: string; altText: string | null; width: number; height: number } | null;
};

export type GuideKeepsakeState = "guest" | "loading" | "error" | "empty" | "records" | "saved" | "stale";

/**
 * The guide page a keepsake is about (each artwork has its own card): its id (the first 8 characters of its content
 * id), title and picture, and the lines on it.
 */
export type KeepsakePage = { page: string; title: string; image: Exhibition["coverImage"]; sentenceIds: Set<string> };

// What an artwork's page shows of the visitor's keepsake for it: a public preview for guests, otherwise the saved card
// or a live preview in the STILL design (SPEC §7.1). Stale means a line was kept on this page after the save; the
// card carries its own note, so the visit's journal changing (another card's note) does not make it stale.
export function useGuideKeepsake(code: string, exhibition: Exhibition, page: KeepsakePage) {
  const trpc = useTRPC();
  const me = useMe();
  const enabled = !!me;
  const scraps = useQuery(trpc.scrap.list.queryOptions({ code }, { enabled }));
  const saved = useQuery(keepsakeQueryOptions(trpc, code, page.page, enabled));
  const queries = [scraps, saved];

  // The line kept most recently in this visit, so the card can let it in. Worked out while rendering,
  // so the new line already knows to ink when it mounts (an effect would run after it had appeared).
  const [visit, setVisit] = useState<{ lines: typeof scraps.data; entering?: string }>({ lines: scraps.data });
  let entering = visit.entering;
  if (scraps.data !== visit.lines) {
    const before = visit.lines;
    const added = before && scraps.data?.find((s) => !before.some((b) => b.sentenceId === s.sentenceId));
    entering = added ? added.sentenceId : entering;
    setVisit({ lines: scraps.data, entering });
  }

  const base = { code, entering, retry: () => queries.filter((q) => q.isError).forEach((q) => void q.refetch()) };
  // The card carries the page: its title and picture, and only the lines kept on it.
  const cover = { exhibition: { ...exhibition, title: page.title }, image: page.image };
  if (!enabled) return { ...base, state: "guest" as const, templateId: "still", card: { ...cover, sentences: [], journalExcerpt: null }, lineCount: 0, hasJournal: false, newLines: 0, journalChanged: false };
  if (queries.some((q) => q.isError)) return { ...base, state: "error" as const, templateId: "still", card: { ...cover, sentences: [], journalExcerpt: null }, lineCount: 0, hasJournal: false, newLines: 0, journalChanged: false };
  if (scraps.data === undefined || saved.data === undefined) {
    return { ...base, state: "loading" as const, templateId: "still", card: { ...cover, sentences: [], journalExcerpt: null }, lineCount: 0, hasJournal: false, newLines: 0, journalChanged: false };
  }

  const lines = scraps.data.filter((s) => page.sentenceIds.has(s.sentenceId));
  const hasJournal = false;
  const counts = { lineCount: lines.length, hasJournal };
  if (saved.data) {
    const since = Date.parse(saved.data.updatedAt);
    const newLines = lines.filter((s) => Date.parse(s.createdAt) > since).length;
    const journalChanged = false;
    const state = newLines > 0 || journalChanged ? ("stale" as const) : ("saved" as const);
    return { ...base, ...counts, state, templateId: saved.data.templateId, card: saved.data.card, keptAt: saved.data.updatedAt, newLines, journalChanged };
  }
  const templateId = "still";
  const card = { ...cover, ...templateDefaults(templateId, lines, null) };
  const state = lines.length === 0 && !hasJournal ? ("empty" as const) : ("records" as const);
  return { ...base, ...counts, state, templateId, card, newLines: 0, journalChanged: false };
}
