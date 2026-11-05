import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

// TEMPORARY (임시) sign-in for the platform admin app. Not designed in Figma yet.
// STILL staff only: one Google button; the server allows only STILL Google Workspace accounts on an allow-list.

export default function SignIn() {
  const { status, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "ready") return <Navigate to={from && from !== "/sign-in" ? from : "/institutions"} replace />;

  const go = async () => {
    setBusy(true);
    setError(null);
    try { await signIn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <div className="pa-signin">
      <header className="pa-signin__head">
        <p className="pa-top__brand">STILL</p>
        <span className="pa-top__label">Platform admin</span>
      </header>
      <main className="pa-signin__body">
        <div className="pa-signin__card">
          <p className="pa-signin__temp">Temporary screen (임시) · not designed yet</p>
          <p className="pa-side__heading pa-signin__eyebrow">STILL internal</p>
          <h1 className="pa-title pa-signin__title">Sign in to platform admin</h1>
          <p className="pa-desc">For STILL staff only. Use your STILL Google account.</p>
          {error && <p className="pa-alert pa-alert--error" role="alert">{error}</p>}
          <button type="button" className="pa-btn pa-btn--primary pa-signin__google" onClick={go} disabled={busy}>
            {busy ? "Signing in…" : "Continue with Google"}
          </button>
          <p className="pa-signin__note">Only STILL Google Workspace accounts on the admin list can sign in. Museum staff sign in at /console.</p>
        </div>
      </main>
    </div>
  );
}
