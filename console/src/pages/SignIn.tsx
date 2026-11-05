import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useWorkspace } from "../store";

// Figma 10 — Institution portal / Sign in. Staff sign in with the institution ID that STILL issued
// (platform admin, Figma 09), their work email and a password. No self sign-up and no social login.

export default function SignIn() {
  const { status, signIn } = useWorkspace();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [form, setForm] = useState({ institutionId: "", email: "", password: "", remember: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  if (status === "ready") return <Navigate to={from && from !== "/sign-in" ? from : "/overview"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.institutionId.trim() || !form.email.trim() || !form.password) {
      setError("Enter your institution ID, work email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn({ ...form, institutionId: form.institutionId.trim(), email: form.email.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setForm((f) => ({ ...f, password: "" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <header className="signin__head">
        <p className="signin__brand">STILL</p>
        <p className="signin__portal">Institution portal</p>
      </header>

      <div className="signin__body">
        <section className="signin__panel" aria-label="About the institution portal">
          <p className="signin__eyebrow">For museums &amp; cultural institutions</p>
          <h2 className="signin__headline">Your exhibition.<br />Your stories.<br />Still with visitors.</h2>
          <p className="signin__pitch">Manage exhibition materials, review your digital guide, and publish a visitor experience through one workspace.</p>
          <p className="signin__panel-foot">STILL&nbsp;&nbsp;·&nbsp;&nbsp;Art stays with you.</p>
        </section>

        <form className="signin__form" onSubmit={submit} noValidate>
          <p className="signin__eyebrow">Welcome back</p>
          <h1 className="signin__title">Sign in to your workspace</h1>
          <p className="signin__desc">Use the credentials provided by your institution administrator.</p>

          <label className="signin__field">
            <span className="signin__label">Institution ID</span>
            <input
              className="signin__input" name="institutionId" autoComplete="organization" placeholder="Enter your institution ID"
              autoCapitalize="characters" spellCheck={false}
              value={form.institutionId} onChange={(e) => setForm({ ...form, institutionId: e.target.value })}
            />
          </label>
          <label className="signin__field">
            <span className="signin__label">Work email</span>
            <input
              className="signin__input" type="email" name="email" autoComplete="username" placeholder="name@institution.org"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="signin__field">
            <span className="signin__label">Password</span>
            <input
              className="signin__input" type="password" name="password" autoComplete="current-password" placeholder="Enter your password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>

          <div className="signin__row">
            <label className="signin__remember">
              <input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} />
              Remember this device
            </label>
            <button type="button" className="signin__forgot" aria-expanded={showReset} onClick={() => setShowReset((v) => !v)}>
              Forgot password?
            </button>
          </div>
          {showReset && (
            <p className="signin__note" role="note">
              Ask your institution administrator to reset your password. Administrators can contact STILL support.
            </p>
          )}

          {error && <p className="signin__error" role="alert">{error}</p>}
          <button type="submit" className="signin__submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>

          <p className="signin__help">Need access? Contact your institution administrator.</p>
          <p className="signin__secure">Secure access for registered institution accounts.</p>
        </form>
      </div>
    </div>
  );
}
