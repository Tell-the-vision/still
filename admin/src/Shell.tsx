import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";

// The admin's one frame, the console's rail-and-page layout: the STILL. wordmark and the operator's menu, the two
// lists (STILL's contract accounts and its operators, SPEC §9.2), and the selected record beside them.
const SECTIONS = {
  institutions: { to: "/institutions", label: "Institutions", add: "New institution" },
  operators: { to: "/operators", label: "Operators", add: "New operator" },
} as const;

export function Shell({ section, rail, children }: { section: keyof typeof SECTIONS; rail: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const current = SECTIONS[section];
  return (
    <div className="pa">
      <aside className="pa-rail">
        <div className="pa-rail__brand">
          <NavLink to="/institutions" className="pa-wordmark">STILL.</NavLink>
          <AccountMenu />
        </div>
        <div className="pa-rail__head">
          <nav className="pa-sections" aria-label="Platform admin">
            {Object.values(SECTIONS).map((s) => <NavLink key={s.to} to={s.to} className="pa-section-link">{s.label}</NavLink>)}
          </nav>
          <button type="button" className="pa-add" aria-label={current.add} onClick={() => navigate(`${current.to}/new`)}>+ New</button>
        </div>
        {rail}
      </aside>
      <main className="pa-page">{children}</main>
    </div>
  );
}

/** "PLATFORM ADMIN ▾", where the console shows the institution's name: who is signed in, and Sign out. */
function AccountMenu() {
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", escape); };
  }, [open]);

  return (
    <div className="pa-account" ref={ref}>
      <button type="button" className="pa-account__trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Platform admin
        <svg width="7" height="4" viewBox="0 0 7 4" aria-hidden><path d="M0 0h7L3.5 4z" fill="currentColor" /></svg>
      </button>
      {open && (
        <div className="pa-account__panel" role="menu">
          {me && <p className="pa-account__who">{me.email}</p>}
          <button type="button" role="menuitem" className="pa-account__item" onClick={() => {
            setError(null);
            signOut().catch((e) => setError(`Could not sign out (${e instanceof Error ? e.message : String(e)}). Try again.`));
          }}>Sign out</button>
          {error && <p className="pa-account__error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
