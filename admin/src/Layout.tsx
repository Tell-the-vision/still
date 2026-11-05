import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth";

// Figma 09 shell: 72px header, 236px sidebar (MANAGEMENT nav, STILL INTERNAL footer).
const NAV = [
  { to: "/overview", label: "Overview" },
  { to: "/institutions", label: "Institutions" },
  { to: "/users", label: "Users & access" },
  { to: "/audit", label: "Audit log" },
  { to: "/settings", label: "Platform settings" },
];

export default function Layout() {
  const { status, me, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const { pathname } = useLocation();

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // No STILL staff session: temporary sign-in screen, then back to this page.
  if (status === "signed-out") return <Navigate to="/sign-in" replace state={{ from: pathname }} />;

  // A temporary password must be changed before anything else (SPEC §10.5).
  if (me?.mustChangePassword) return <Navigate to="/change-password" replace />;

  return (
    <div className="pa">
      <header className="pa-top">
        <button type="button" className="pa-top__menu" aria-expanded={menuOpen} aria-controls="pa-sidebar" onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? "Close" : "Menu"}
        </button>
        <NavLink to="/institutions" className="pa-top__brand">STILL</NavLink>
        <span className="pa-top__label">Platform admin</span>
        <span className="pa-top__workspace">Global workspace</span>
        {me && (
          <span className="pa-top__who">
            <span className="pa-top__id"><span className="pa-top__role">Super admin</span>&nbsp;&nbsp;·&nbsp;&nbsp;{me.email}</span>
            <button type="button" className="pa-link pa-top__signout" onClick={() => {
              setSignOutError(null);
              signOut().catch((e) => setSignOutError(`Could not sign out (${e instanceof Error ? e.message : String(e)}). Try again.`));
            }}>Sign out</button>
          </span>
        )}
      </header>

      <div className="pa-body">
        <aside id="pa-sidebar" className={`pa-side${menuOpen ? " is-open" : ""}`}>
          <p className="pa-side__heading">Management</p>
          <nav className="pa-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `pa-nav__link${isActive ? " is-active" : ""}`}>{n.label}</NavLink>
            ))}
          </nav>
          <p className="pa-side__foot">STILL internal</p>
        </aside>
        {menuOpen && <div className="pa-scrim" onClick={() => setMenuOpen(false)} />}
        <main className="pa-main">
          {signOutError && <p className="pa-alert pa-alert--error" role="alert">{signOutError} <button type="button" className="pa-link" onClick={() => setSignOutError(null)}>Dismiss</button></p>}
          {status === "loading" ? <p className="pa-loading">Loading…</p> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
