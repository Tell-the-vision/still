import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

// TEMPORARY (임시) sign-in for the platform admin app. Not designed in Figma yet.
// STILL operators sign in with the email and password STILL Admin issued them (SPEC §9.2).

export default function SignIn() {
  const { status, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "ready") return <Navigate to={from && from !== "/sign-in" ? from : "/institutions"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) { setError("Enter your email and password."); return; }
    setBusy(true);
    setError(null);
    try {
      await signIn(form.email.trim(), form.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setForm((f) => ({ ...f, password: "" }));
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
          <p className="pa-signin__temp">Temporary screen (임시) · not designed yet</p>
          <p className="pa-side__heading pa-signin__eyebrow">STILL internal</p>
          <h1 className="pa-title pa-signin__title">Sign in to platform admin</h1>
          <p className="pa-desc">For STILL operators only. Use the email and password you were issued.</p>
          <label className="pa-signin__field">
            <span className="pa-field-label">Email</span>
            <input className="pa-input" type="email" name="email" autoComplete="username"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="pa-signin__field">
            <span className="pa-field-label">Password</span>
            <input className="pa-input" type="password" name="password" autoComplete="current-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          {error && <p className="pa-alert pa-alert--error" role="alert">{error}</p>}
          <button type="submit" className="pa-btn pa-btn--primary pa-signin__submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="pa-signin__note">Museum staff sign in at /institutions.</p>
        </form>
      </main>
    </div>
  );
}
