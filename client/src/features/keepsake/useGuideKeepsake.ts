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

// What the Guide shows of the visitor's keepsake: a public preview for guests, otherwise the saved card
// or a live preview of today's defaults (SPEC §7.1). Stale means a line was kept or the journal revised after the save.
export function useGuideKeepsake(code: string, exhibition: Exhibition) {
  const trpc = useTRPC();
  const me = useMe();
  const enabled = !!me;
  const scraps = useQuery(trpc.scrap.list.queryOptions({ code }, { enabled }));
  const journal = useQuery(trpc.journal.get.queryOptions({ code }, { enabled }));
  const saved = useQuery(keepsakeQueryOptions(trpc, code, enabled));
  const queries = [scraps, journal, saved];

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
  const cover = { exhibition, image: exhibition.coverImage };
  if (!enabled) return { ...base, state: "guest" as const, templateId: "sentence", card: { ...cover, sentences: [], journalExcerpt: null }, lineCount: 0, hasJournal: false, newLines: 0, journalChanged: false };
  if (queries.some((q) => q.isError)) return { ...base, state: "error" as const, templateId: "sentence", card: { ...cover, sentences: [], journalExcerpt: null }, lineCount: 0, hasJournal: false, newLines: 0, journalChanged: false };
  if (scraps.data === undefined || journal.data === undefined || saved.data === undefined) {
    return { ...base, state: "loading" as const, templateId: "sentence", card: { ...cover, sentences: [], journalExcerpt: null }, lineCount: 0, hasJournal: false, newLines: 0, journalChanged: false };
  }

  const lines = scraps.data;
  const hasJournal = journal.data !== null;
  const counts = { lineCount: lines.length, hasJournal };
  if (saved.data) {
    const since = Date.parse(saved.data.updatedAt);
    const newLines = lines.filter((s) => Date.parse(s.createdAt) > since).length;
    const journalChanged = journal.data !== null && Date.parse(journal.data.updatedAt) > since;
    const state = newLines > 0 || journalChanged ? ("stale" as const) : ("saved" as const);
    return { ...base, ...counts, state, templateId: saved.data.templateId, card: saved.data.card, keptAt: saved.data.updatedAt, newLines, journalChanged };
  }
  const templateId = lines.length === 0 && hasJournal ? "reflection" : "sentence";
  const card = { ...cover, ...templateDefaults(templateId, lines, journal.data?.content ?? null) };
  const state = lines.length === 0 && !hasJournal ? ("empty" as const) : ("records" as const);
  return { ...base, ...counts, state, templateId, card, newLines: 0, journalChanged: false };
}
