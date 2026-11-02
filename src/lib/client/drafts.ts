/**
 * Journal draft protection (JOURNAL-05, TBD-10).
 * Drafts live in localStorage per exhibition so they survive the Google
 * login round-trip, a reload, and short offline periods.
 */
const prefix = "still:draft:journal:";

export type JournalDraft = { content: string; audioType: string; updatedAt: number };

export function saveJournalDraft(exhibitionSlug: string, draft: Omit<JournalDraft, "updatedAt">) {
  try {
    localStorage.setItem(prefix + exhibitionSlug, JSON.stringify({ ...draft, updatedAt: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function loadJournalDraft(exhibitionSlug: string): JournalDraft | null {
  try {
    const raw = localStorage.getItem(prefix + exhibitionSlug);
    return raw ? (JSON.parse(raw) as JournalDraft) : null;
  } catch {
    return null;
  }
}

export function clearJournalDraft(exhibitionSlug: string) {
  try {
    localStorage.removeItem(prefix + exhibitionSlug);
  } catch {
    /* ignore */
  }
}

/** Keepsake drafts only need to survive the login redirect → sessionStorage. */
const keepsakePrefix = "still:draft:keepsake:";

export type KeepsakeDraft = {
  templateId: string;
  sentence: string | null;
  journalExcerpt: string | null;
};

export function saveKeepsakeDraft(exhibitionSlug: string, draft: KeepsakeDraft) {
  try {
    sessionStorage.setItem(keepsakePrefix + exhibitionSlug, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function loadKeepsakeDraft(exhibitionSlug: string): KeepsakeDraft | null {
  try {
    const raw = sessionStorage.getItem(keepsakePrefix + exhibitionSlug);
    return raw ? (JSON.parse(raw) as KeepsakeDraft) : null;
  } catch {
    return null;
  }
}

export function clearKeepsakeDraft(exhibitionSlug: string) {
  try {
    sessionStorage.removeItem(keepsakePrefix + exhibitionSlug);
  } catch {
    /* ignore */
  }
}
