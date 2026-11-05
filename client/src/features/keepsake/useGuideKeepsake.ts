import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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

// What the Guide shows of the visitor's keepsake: a public preview for guests, otherwise the saved card
// or a live preview of today's defaults (SPEC §7.1). Stale means a line was kept or the journal revised after the save.
export function useGuideKeepsake(code: string, exhibition: Exhibition, page: KeepsakePage) {
  const trpc = useTRPC();
  const me = useMe();
  const enabled = !!me;
  const scraps = useQuery(trpc.scrap.list.queryOptions({ code }, { enabled }));
  const journal = useQuery(trpc.journal.get.queryOptions({ code }, { enabled }));
  const saved = useQuery(keepsakeQueryOptions(trpc, code, page.page, enabled));
  const queries = [scraps, journal, saved];

  // The line kept most recently in this visit, so the card can let it in.
  const known = useRef<Set<string> | undefined>(undefined);
  const [entering, setEntering] = useState<string>();
  useEffect(() => {
    if (!scraps.data) return;
    const ids = new Set(scraps.data.map((s) => s.sentenceId));
    const added = known.current && scraps.data.find((s) => !known.current?.has(s.sentenceId));
    known.current = ids;
    if (added) setEntering(added.sentenceId);
  }, [scraps.data]);

  const base = { code, entering, retry: () => queries.filter((q) => q.isError).forEach((q) => void q.refetch()) };
  // The card carries the page: its title and picture, and only the lines kept on it.
  const cover = { exhibition: { ...exhibition, title: page.title }, image: page.image };
  if (!enabled) return { ...base, state: "guest" as const, templateId: "sentence", card: { ...cover, sentences: [], journalExcerpt: null }, lineCount: 0, hasJournal: false, newLines: 0, journalChanged: false };
  if (queries.some((q) => q.isError)) return { ...base, state: "error" as const, templateId: "sentence", card: { ...cover, sentences: [], journalExcerpt: null }, lineCount: 0, hasJournal: false, newLines: 0, journalChanged: false };
  if (scraps.data === undefined || journal.data === undefined || saved.data === undefined) {
    return { ...base, state: "loading" as const, templateId: "sentence", card: { ...cover, sentences: [], journalExcerpt: null }, lineCount: 0, hasJournal: false, newLines: 0, journalChanged: false };
  }

  const lines = scraps.data.filter((s) => page.sentenceIds.has(s.sentenceId));
  const hasJournal = false;
  const counts = { lineCount: lines.length, hasJournal };
  if (saved.data) {
    const since = Date.parse(saved.data.updatedAt);
    const newLines = lines.filter((s) => Date.parse(s.createdAt) > since).length;
    const journalChanged = journal.data !== null && Date.parse(journal.data.updatedAt) > since;
    const state = newLines > 0 || journalChanged ? ("stale" as const) : ("saved" as const);
    return { ...base, ...counts, state, templateId: saved.data.templateId, card: saved.data.card, keptAt: saved.data.updatedAt, newLines, journalChanged };
  }
  const templateId = lines.length === 0 && hasJournal ? "reflection" : "sentence";
  const card = { ...cover, ...templateDefaults(templateId, lines, null) };
  const state = lines.length === 0 && !hasJournal ? ("empty" as const) : ("records" as const);
  return { ...base, ...counts, state, templateId, card, newLines: 0, journalChanged: false };
}
