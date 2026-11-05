import { useState } from "react";
import type { Account, InstitutionStatus } from "./api";

// Small pieces both lists share: how dates and states read, the status dot, the in-place confirmation and the
// temporary password that is shown once.

/** Text people can act on; LAST_ADMIN gets its own sentence. */
export const messageOf = (e: unknown) => {
  if (e && typeof e === "object" && "appCode" in e && e.appCode === "LAST_ADMIN") return "STILL must keep at least one active operator, so this account cannot be suspended or deleted.";
  return e instanceof Error ? e.message : String(e);
};

const DAY = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
/** "05 Nov 2026", as the console writes dates. */
export const formatDate = (iso: string) => DAY.format(new Date(iso));

/** Today, Yesterday, 3 days ago, then the date; `never` until the first sign-in. */
export function since(iso: string | null, never: string) {
  if (!iso) return never;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(new Date(iso))) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

export const INSTITUTION_STATUS: Record<InstitutionStatus, string> = { ACTIVE: "Active", PENDING: "Pending setup", SUSPENDED: "Suspended" };
export const ACCOUNT_STATUS: Record<Account["status"], string> = { ACTIVE: "Active", SUSPENDED: "Suspended" };

/** The console's status dot: filled green in use, hollow before the first sign-in, grey while suspended. */
export function Dot({ status }: { status: InstitutionStatus | Account["status"] }) {
  return <span className={`pa-dot pa-dot--${status.toLowerCase()}`} aria-hidden />;
}

/** Asks once, in place, before a step that signs people out or cannot be undone. */
export function Confirm({ question, action, danger = false, onConfirm, onCancel }: {
  question: string; action: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <span className="pa-confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <button type="button" className={`pa-link${danger ? " pa-link--danger" : ""}`} onClick={onConfirm}>{action}</button>
      <button type="button" className="pa-link" onClick={onCancel}>Cancel</button>
    </span>
  );
}

/** A new temporary password. The server keeps only a hash, so once this is dismissed it is gone (SPEC §9.2, §10.5). */
export function TemporaryPassword({ email, password, onDismiss }: { email: string; password: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  // Without clipboard access the password stays selectable: one click on it selects all of it.
  const copy = () => navigator.clipboard.writeText(password).then(() => setCopied("yes"), () => setCopied("failed"));
  return (
    <div className="pa-secret" role="status">
      <p>Temporary password for {email}. They must change it at their next sign-in.</p>
      <p className="pa-secret__row">
        <code className="pa-secret__code" data-testid="temporary-password">{password}</code>
        <button type="button" className="pa-btn pa-btn--secondary" onClick={copy}>{copied === "yes" ? "Copied" : copied === "failed" ? "Select and copy" : "Copy"}</button>
      </p>
      <p className="pa-secret__note">
        It is shown only once. Pass it on now. <button type="button" className="pa-link" onClick={onDismiss}>Dismiss</button>
      </p>
    </div>
  );
}
