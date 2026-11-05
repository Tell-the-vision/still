import { useEffect } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";
import { useWorkspace } from "./store";

export default function Layout() {
  const { pathname } = useLocation();
  const { status, error, clearError } = useWorkspace();
  // The editor and the exhibitions list are whole-screen: their rail carries the brand, the account and the page's actions.
  const bare = pathname === "/" || pathname.startsWith("/exhibitions/") || pathname === "/workspace" || pathname === "/published";

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  // No staff session: go to sign-in and come back to this page afterwards.
  if (status === "signed-out") return <Navigate to="/sign-in" replace state={{ from: pathname }} />;

  // A temporary password must be changed before anything else (SPEC §10.5).
  if (status === "password-change") return <Navigate to="/change-password" replace />;

  return (
    <div className={`app${bare ? " app--bare" : ""}`}>
      {!bare && (
        <header className="topbar">
          <NavLink to="/" className="wordmark">STILL.</NavLink>
          <NavLink to="/workspace" className={({ isActive }) => `topbar__workspace${isActive ? " is-active" : ""}`}>Exhibitions</NavLink>
          <AccountMenu />
        </header>
      )}

      <div className="body">
        <main className={`main${bare ? " main--full" : ""}`}>
          <div className="main__inner">
            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button type="button" className="link-btn" onClick={clearError}>Dismiss</button>
              </div>
            )}
            {status === "loading" ? <p className="loading">Loading…</p> : status === "error" ? null : <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
