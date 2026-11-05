import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";

// TEMPORARY (임시) first-login screen for the platform admin app. Not designed in Figma yet.
// An operator who signed in with a temporary password chooses their own before anything else (SPEC §9.2, §10.5).

export default function ChangePassword() {
  const { status, me, changePassword, signOut } = useAuth();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]); // a failed submit moves focus to the message

  if (status === "signed-out") return <Navigate to="/sign-in" replace />;
  if (status === "ready" && !me?.mustChangePassword) return <Navigate to="/institutions" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.current || !form.next) { setError("Enter your temporary password and a new password."); return; }
    if (form.next !== form.confirm) { setError("The new passwords do not match."); return; }
    setBusy(true);
    setError(null);
    try {
      await changePassword(form.current, form.next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="pa-signin">
      <header className="pa-signin__head">
        <p className="pa-top__brand">STILL</p>
        <span className="pa-top__label">Platform admin</span>
      </header>
      <main className="pa-signin__body">
        <form className="pa-signin__card" onSubmit={submit} noValidate>
          <p className="pa-side__heading pa-signin__eyebrow">STILL internal</p>
          <h1 className="pa-title pa-signin__title">Choose a new password</h1>
          <p className="pa-desc">You signed in with a temporary password. Choose your own to continue. Other devices are signed out.</p>
          <label className="pa-signin__field">
            <span className="pa-field-label">Temporary password</span>
            <input className="pa-input" type="password" name="current" autoComplete="current-password" aria-invalid={error ? true : undefined} aria-describedby={error ? "pa-pw-error" : undefined}
              value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          </label>
          <label className="pa-signin__field">
            <span className="pa-field-label">New password</span>
            <input className="pa-input" type="password" name="new" autoComplete="new-password" aria-invalid={error ? true : undefined} aria-describedby={error ? "pa-pw-hint pa-pw-error" : "pa-pw-hint"}
              value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          </label>
          <p id="pa-pw-hint" className="pa-signin__note">At least 12 characters.</p>
          <label className="pa-signin__field">
            <span className="pa-field-label">Confirm new password</span>
            <input className="pa-input" type="password" name="confirm" autoComplete="new-password" aria-invalid={error ? true : undefined} aria-describedby={error ? "pa-pw-error" : undefined}
              value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </label>
          {error && <p id="pa-pw-error" ref={errorRef} tabIndex={-1} className="pa-alert pa-alert--error" role="alert">{error}</p>}
          <button type="submit" className="pa-btn pa-btn--primary pa-signin__submit" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </button>
          <p className="pa-signin__note">
            <button type="button" className="pa-link" onClick={() => { signOut().catch(() => {}); }}>Sign out</button>
          </p>
        </form>
      </main>
    </div>
  );
}
