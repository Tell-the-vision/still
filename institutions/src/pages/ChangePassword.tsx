import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useWorkspace } from "../store";

// TEMPORARY (임시) first-login screen. Not designed in Figma yet (REVIEW §7-11).
// Staff who signed in with a temporary password choose their own before anything else (SPEC §9.2, §10.5).
// Reuses the sign-in classes.

export default function ChangePassword() {
  const { status, changePassword, signOut } = useWorkspace();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]); // a failed submit moves focus to the message

  if (status === "signed-out") return <Navigate to="/sign-in" replace />;
  if (status === "ready" || status === "error") return <Navigate to="/overview" replace />;

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
    <div className="signin">
      <header className="signin__head">
        <p className="signin__brand">STILL</p>
        <p className="signin__portal">Institution portal</p>
      </header>

      <div className="signin__body signin__body--single">
        <form className="signin__form" onSubmit={submit} noValidate>
          <p className="signin__note">Temporary screen (임시) · not designed yet</p>
          <p className="signin__eyebrow">First sign-in</p>
          <h1 className="signin__title">Choose a new password</h1>
          <p className="signin__desc">You signed in with a temporary password. Choose your own to continue. Other devices are signed out.</p>

          <label className="signin__field">
            <span className="signin__label">Temporary password</span>
            <input className="signin__input" type="password" name="current" autoComplete="current-password" aria-invalid={error ? true : undefined} aria-describedby={error ? "pw-error" : undefined}
              value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          </label>
          <label className="signin__field">
            <span className="signin__label">New password</span>
            <input className="signin__input" type="password" name="new" autoComplete="new-password" aria-invalid={error ? true : undefined} aria-describedby={error ? "pw-hint pw-error" : "pw-hint"}
              value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          </label>
          <p id="pw-hint" className="signin__label">At least 12 characters.</p>
          <label className="signin__field">
            <span className="signin__label">Confirm new password</span>
            <input className="signin__input" type="password" name="confirm" autoComplete="new-password" aria-invalid={error ? true : undefined} aria-describedby={error ? "pw-error" : undefined}
              value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </label>

          {error && <p id="pw-error" ref={errorRef} tabIndex={-1} className="signin__error" role="alert">{error}</p>}
          <button type="submit" className="signin__submit" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
          <p className="signin__help">
            <button type="button" className="signin__forgot" onClick={() => { signOut().catch(() => {}); }}>Sign out</button>
          </p>
        </form>
      </div>
    </div>
  );
}
