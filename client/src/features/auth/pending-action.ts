import { sessionStore } from "../../lib/storage";

export type PendingAction = { kind: "SCRAP_SAVE"; exhibitionCode: string; sentenceId: string } | { kind: "JOURNAL_SAVE"; exhibitionCode: string };

const KEY = "still:pending-action";
const MAX_AGE_MS = 30 * 60_000;

// A guest's interrupted action, kept across the login round trip (SPEC §2.2 Sign in).
export async function savePendingAction(action: PendingAction) {
  await sessionStore.setItem(KEY, JSON.stringify({ ...action, createdAt: Date.now() }));
}

export async function peekPendingAction(): Promise<PendingAction | null> {
  const raw = await sessionStore.getItem(KEY);
  return raw ? (JSON.parse(raw) as PendingAction) : null;
}

// Returns the stored action when it matches, and removes it first so it runs at most once.
export async function takePendingAction<K extends PendingAction["kind"]>(match: { kind: K; exhibitionCode: string }): Promise<Extract<PendingAction, { kind: K }> | "expired" | null> {
  const raw = await sessionStore.getItem(KEY);
  if (!raw) return null;
  const { createdAt, ...action } = JSON.parse(raw) as PendingAction & { createdAt: number };
  if (action.kind !== match.kind || action.exhibitionCode !== match.exhibitionCode) return null;
  await clearPendingAction();
  return Date.now() - createdAt > MAX_AGE_MS ? "expired" : (action as Extract<PendingAction, { kind: K }>);
}

export async function clearPendingAction() {
  await sessionStore.removeItem(KEY);
}
