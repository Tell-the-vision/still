import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useWorkspace } from "./store";

/** The institution's menu: its exhibitions, the person's account, venues, help and sign-out. */
export function AccountMenu({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { workspace, me, signOut } = useWorkspace();

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!workspace) return null;
  return (
    <div className={`account-menu ${className}`} ref={ref}>
      <button type="button" className="topbar__user" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {/* The account name, not a role: everyone in an institution has the same permissions (SPEC §9.2). */}
        {workspace.institutionName}
        <span aria-hidden className="account-menu__caret">▾</span>
      </button>
      {open && (
        <div className="account-menu__panel" role="menu" onClick={() => setOpen(false)}>
          {me && (
            <div className="account-menu__who">
              <p className="strong">{me.name}</p>
              <p className="caption-sm">{me.email}</p>
            </div>
          )}
          {/* Titles, venues and dates of each exhibition are decided there. */}
          <NavLink to="/workspace" role="menuitem" className="account-menu__item">Exhibitions</NavLink>
          <NavLink to="/account" role="menuitem" className="account-menu__item">Your account</NavLink>
          <NavLink to="/venues" role="menuitem" className="account-menu__item">Venues</NavLink>
          <NavLink to="/help" role="menuitem" className="account-menu__item">Help &amp; support</NavLink>
          <button type="button" role="menuitem" className="account-menu__item" onClick={() => signOut().catch(() => {})}>Sign out</button>
        </div>
      )}
    </div>
  );
}
