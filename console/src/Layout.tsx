import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { ROLES } from "./rules";
import { useWorkspace } from "./store";

const WORKSPACE_NAV = [
  { to: "/overview", label: "Overview" },
  { to: "/materials", label: "Exhibition materials" },
  { to: "/guide", label: "Digital guide" },
  { to: "/exhibitions", label: "Published exhibitions" },
];
const ACCOUNT_NAV = [
  { to: "/settings", label: "Workspace settings" },
  { to: "/help", label: "Help & support" },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const { workspace, me, status, error, clearError, signOut } = useWorkspace();

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => { if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAccountOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [accountOpen]);

  const link = ({ isActive }: { isActive: boolean }) => `nav__link${isActive ? " is-active" : ""}`;

  // No staff session: go to sign-in and come back to this page afterwards.
  if (status === "signed-out") return <Navigate to="/sign-in" replace state={{ from: pathname }} />;

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="topbar__menu"
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
        <NavLink to="/overview" className="wordmark">STILL.</NavLink>
        <span className="topbar__workspace">Museum workspace</span>
        {workspace && (
          <div className="account-menu" ref={accountRef}>
            <button
              type="button"
              className="topbar__user"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((o) => !o)}
            >
              {workspace.institutionName} <span aria-hidden>/</span> {me ? ROLES[me.role].label : workspace.role}
              <span aria-hidden className="account-menu__caret">▾</span>
            </button>
            {accountOpen && (
              <div className="account-menu__panel" role="menu">
                {me && (
                  <div className="account-menu__who">
                    <p className="strong">{me.name}</p>
                    <p className="caption-sm">{me.email}</p>
                  </div>
                )}
                <NavLink to="/account" role="menuitem" className="account-menu__item">Your account</NavLink>
                <NavLink to="/settings" role="menuitem" className="account-menu__item">Workspace settings</NavLink>
                <NavLink to="/help" role="menuitem" className="account-menu__item">Help &amp; support</NavLink>
                <button
                  type="button"
                  role="menuitem"
                  className="account-menu__item"
                  onClick={() => { setAccountOpen(false); signOut().catch(() => {}); }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="body">
        <aside id="sidebar" className={`sidebar${menuOpen ? " is-open" : ""}`}>
          <NavLink to="/workspace" className={({ isActive }) => `eyebrow sidebar__label sidebar__label--link${isActive ? " is-active" : ""}`}>Workspace</NavLink>
          <nav className="nav">
            {WORKSPACE_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>
            ))}
          </nav>
          <hr className="sidebar__rule" />
          <NavLink to="/account" className={({ isActive }) => `eyebrow sidebar__label sidebar__label--link${isActive ? " is-active" : ""}`}>Account</NavLink>
          <nav className="nav">
            {ACCOUNT_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>
            ))}
          </nav>
        </aside>
        {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

        <main className="main">
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
