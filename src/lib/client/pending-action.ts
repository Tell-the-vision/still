/**
 * Login interruption & resume (PRD §6.3, User Flow 7.1 / 7.3 / 7.4).
 *
 * When a guest triggers a save action we stash *what they were doing* in
 * sessionStorage, send them to /login, and after the OAuth round-trip the
 * originating screen calls `consumePendingAction()` to finish the job.
 *
 * sessionStorage survives the OAuth redirects (same tab) and is cleared when
 * the tab closes — exactly the lifetime we want.
 */

export type PendingAction =
  | { type: "scrap"; exhibitionSlug: string; guideSentenceId: string }
  | { type: "journal"; exhibitionSlug: string }
  | { type: "keepsake"; exhibitionSlug: string; templateId: string }
  | { type: "archive-register"; exhibitionSlug: string }
  | { type: "like"; exhibitionSlug: string }
  | { type: "report"; exhibitionSlug: string };

/** "artist" when the person chose 아티스트 on the login screen (see LoginForm). */
const INTENT_KEY = "still:signin-intent";
export type SigninIntent = "user" | "artist";

export function saveSigninIntent(intent: SigninIntent) {
  try {
    sessionStorage.setItem(INTENT_KEY, intent);
  } catch {
    /* ignore */
  }
}

export function consumeSigninIntent(): SigninIntent | null {
  try {
    const v = sessionStorage.getItem(INTENT_KEY) as SigninIntent | null;
    if (v) sessionStorage.removeItem(INTENT_KEY);
    return v;
  } catch {
    return null;
  }
}

const KEY = "still:pending-action";

export function savePendingAction(action: PendingAction) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...action, savedAt: Date.now() }));
  } catch {
    /* private mode etc. — resume just won't happen */
  }
}

export function peekPendingAction(): PendingAction | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAction & { savedAt?: number };
    // Ignore stale actions (> 30 min) — the user has clearly moved on.
    if (parsed.savedAt && Date.now() - parsed.savedAt > 30 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Returns the pending action for this screen (if any) and clears it. */
export function consumePendingAction<T extends PendingAction["type"]>(
  type: T,
  exhibitionSlug?: string,
): Extract<PendingAction, { type: T }> | null {
  const a = peekPendingAction();
  if (!a || a.type !== type) return null;
  if (exhibitionSlug && a.exhibitionSlug !== exhibitionSlug) return null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return a as Extract<PendingAction, { type: T }>;
}

export function clearPendingAction() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Build the /login URL that returns the user to `returnTo` afterwards. */
export function loginUrl(returnTo: string) {
  return `/login?callbackUrl=${encodeURIComponent(returnTo)}`;
}
