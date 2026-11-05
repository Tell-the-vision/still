import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, type Institution, type InstitutionStatus } from "../api";
import { AccountNotIssuedError } from "../api/errors";

// Figma 09 — Platform admin / Institution ID management (node 219:2).
// STILL issues each institution its ID (staff type it to sign in, Figma 10) and the first institution admin's account.

type StatusFilter = "ALL" | InstitutionStatus;
type Sort = "recent" | "name" | "active";
const PAGE_SIZE = 10;
const STATUS_LABEL: Record<InstitutionStatus, string> = { ACTIVE: "Active", PENDING: "Pending", SUSPENDED: "Suspended" };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
function lastActive(iso: string | null) {
  if (!iso) return "—";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(new Date(iso))) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return ymd(iso);
}

export default function Institutions() {
  const [list, setList] = useState<Institution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => { api.listInstitutions().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e))); }, []);
  useEffect(() => { setPage(0); }, [query, status, sort]);

  const all = list ?? [];
  const counts = {
    total: all.length,
    ACTIVE: all.filter((i) => i.status === "ACTIVE").length,
    PENDING: all.filter((i) => i.status === "PENDING").length,
    SUSPENDED: all.filter((i) => i.status === "SUSPENDED").length,
  };
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = all.filter((i) => (status === "ALL" || i.status === status)
      && (!q || i.name.toLowerCase().includes(q) || i.publicId.toLowerCase().includes(q)));
    const by: Record<Sort, (a: Institution, b: Institution) => number> = {
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      name: (a, b) => a.name.localeCompare(b.name),
      active: (a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""),
    };
    return [...hits].sort(by[sort]);
  }, [all, query, status, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const replace = (inst: Institution) => setList((l) => (l ?? []).map((x) => (x.id === inst.id ? inst : x)));
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setError(null);
    try { await fn(); setNotice(done); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="pa-page">
      <div className="pa-head">
        <div>
          <p className="pa-crumb">Platform admin&nbsp;&nbsp;/&nbsp;&nbsp;Institutions</p>
          <h1 className="pa-title">Institutions</h1>
          <p className="pa-desc">Manage institution workspaces and their unique STILL institution IDs.</p>
        </div>
        <button type="button" className="pa-btn pa-btn--primary pa-head__action" onClick={() => setAdding(true)}>Add institution</button>
      </div>

      <section className="pa-metrics" aria-label="Institution counts">
        {([[counts.total, "Total institutions"], [counts.ACTIVE, "Active"], [counts.PENDING, "Pending setup"], [counts.SUSPENDED, "Suspended"]] as const).map(([n, label]) => (
          <div key={label} className="pa-metric">
            <p className="pa-metric__value">{list ? n : "–"}</p>
            <p className="pa-metric__label">{label}</p>
          </div>
        ))}
      </section>

      <div className="pa-filters">
        <label className="pa-search">
          <span className="pa-field-label">Search</span>
          <input className="pa-input" type="search" placeholder="Search institution name or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select className="pa-select pa-select--status" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="ALL">Status: All</option>
          <option value="ACTIVE">Status: Active</option>
          <option value="PENDING">Status: Pending</option>
          <option value="SUSPENDED">Status: Suspended</option>
        </select>
        <select className="pa-select pa-select--sort" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recent">Sort: Recently added</option>
          <option value="name">Sort: Name A–Z</option>
          <option value="active">Sort: Last active</option>
        </select>
        <p className="pa-count" aria-live="polite">{rows.length} institution{rows.length === 1 ? "" : "s"}</p>
      </div>

      {error && <p className="pa-alert pa-alert--error" role="alert">{error} <button type="button" className="pa-link" onClick={() => setError(null)}>Dismiss</button></p>}
      {notice && <p className="pa-alert" role="status">{notice} <button type="button" className="pa-link" onClick={() => setNotice(null)}>Dismiss</button></p>}

      <div className="pa-table" role="table" aria-label="Institutions">
        <div className="pa-tr pa-tr--head" role="row">
          {["Institution", "Institution ID", "Workspace admin", "Status", "Created", "Last active"].map((h) => <span key={h} role="columnheader">{h}</span>)}
        </div>
        {!list && !error && <p className="pa-empty">Loading…</p>}
        {list && shown.length === 0 && <p className="pa-empty">No institutions match.</p>}
        {shown.map((i) => (
          <div key={i.id} className="pa-tr" role="row">
            <span role="cell" className="pa-td-name">{i.name}</span>
            <span role="cell">{i.publicId}</span>
            <span role="cell" className="pa-td-email">{i.adminEmail}</span>
            <span role="cell"><span className={`pa-badge pa-badge--${i.status.toLowerCase()}`}>{STATUS_LABEL[i.status]}</span></span>
            <span role="cell">{ymd(i.createdAt)}</span>
            <span role="cell">{lastActive(i.lastActiveAt)}</span>
            <RowMenu
              inst={i}
              onCopy={() => act(() => navigator.clipboard.writeText(i.publicId), `Copied ${i.publicId}.`)}
              onResend={() => act(() => api.resendInvite(i.id), `Sent a new invitation to ${i.adminEmail}.`)}
              onSetStatus={(s) => act(async () => replace(await api.setInstitutionStatus(i.id, s)),
                s === "SUSPENDED" ? `${i.name} is suspended. Its staff can no longer sign in.` : `${i.name} is reactivated.`)}
            />
          </div>
        ))}
        <div className="pa-pager">
          <span>Rows per page&nbsp;&nbsp;{PAGE_SIZE}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{rows.length ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + shown.length}` : "0"} of {rows.length}</span>
          {pages > 1 && (
            <span className="pa-pager__nav">
              <button type="button" className="pa-link" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button type="button" className="pa-link" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
            </span>
          )}
        </div>
      </div>

      <p className="pa-note">Institution IDs are unique system identifiers. Suspend or reactivate access without deleting institution history.</p>

      {adding && (
        <AddInstitution
          all={all}
          onClose={() => setAdding(false)}
          onAdded={(inst) => {
            setList((l) => [...(l ?? []).filter((x) => x.id !== inst.id), inst]);
            setSort("recent");
            setNotice(`Created ${inst.name} with ID ${inst.publicId}.`);
          }}
        />
      )}
    </div>
  );
}

function RowMenu({ inst, onCopy, onResend, onSetStatus }: {
  inst: Institution; onCopy: () => void; onResend: () => void; onSetStatus: (s: "ACTIVE" | "SUSPENDED") => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(false); setConfirm(false); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setConfirm(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const pick = (fn: () => void) => () => { setOpen(false); setConfirm(false); fn(); };

  return (
    <div className="pa-rowmenu" ref={ref}>
      <button type="button" className="pa-rowmenu__btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${inst.name}`} onClick={() => setOpen((o) => !o)}>⋯</button>
      {open && (
        <div className="pa-rowmenu__panel" role="menu">
          <button type="button" role="menuitem" onClick={pick(onCopy)}>Copy institution ID</button>
          {inst.status === "PENDING" && <button type="button" role="menuitem" onClick={pick(onResend)}>Resend invitation</button>}
          {inst.status === "SUSPENDED" ? (
            <button type="button" role="menuitem" onClick={pick(() => onSetStatus("ACTIVE"))}>Reactivate access</button>
          ) : confirm ? (
            <div className="pa-rowmenu__confirm">
              <span>Suspend? Staff are signed out; data is kept.</span>
              <button type="button" className="pa-link pa-link--danger" onClick={pick(() => onSetStatus("SUSPENDED"))}>Suspend</button>
              <button type="button" className="pa-link" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" role="menuitem" className="pa-danger" onClick={() => setConfirm(true)}>Suspend access…</button>
          )}
        </div>
      )}
    </div>
  );
}

// Not in Figma: the form behind "Add institution". Kept to the fields an ID and a first account need.
// Three steps: the form; if only the account step failed, the form again to retry just that step (the
// institution already exists); then the temporary password, shown once.
function AddInstitution({ all, onClose, onAdded }: { all: Institution[]; onClose: () => void; onAdded: (inst: Institution) => void }) {
  const [form, setForm] = useState({ name: "", code: "", adminName: "", adminEmail: "" });
  const [created, setCreated] = useState<Institution | null>(null); // the institution exists, its account does not
  const [issued, setIssued] = useState<{ institution: Institution; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = created ? await api.issueWorkspaceAdmin(created, form) : await api.createInstitution(form, all);
      onAdded(result.institution);
      setIssued(result);
    } catch (err) {
      if (err instanceof AccountNotIssuedError) { setCreated(err.institution); onAdded(err.institution); }
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(issued!.temporaryPassword); setCopied(true); } catch { setError("Could not copy. Select the password and copy it by hand."); }
  };
  const code = form.code.trim().toUpperCase() || "CODE";

  if (issued) {
    return (
      <dialog ref={dialog} className="pa-dialog" onClose={onClose} onCancel={(e) => e.preventDefault()} aria-labelledby="add-title">
        <h2 id="add-title" className="pa-dialog__title">Institution created</h2>
        <p className="pa-desc">{issued.institution.name} now has the ID <strong>{issued.institution.publicId}</strong>. Give {issued.institution.adminEmail} this temporary password. They must change it when they first sign in.</p>
        <p className="pa-dfield"><span className="pa-field-label">Temporary password</span><code className="pa-input" data-testid="temporary-password">{issued.temporaryPassword}</code></p>
        <p className="pa-alert" role="status">It will not be shown again. Copy it now.</p>
        {error && <p className="pa-alert pa-alert--error" role="alert">{error}</p>}
        <div className="pa-dialog__actions">
          <button type="button" className="pa-btn pa-btn--secondary" onClick={copy}>{copied ? "Copied" : "Copy password"}</button>
          <button type="button" className="pa-btn pa-btn--primary" onClick={() => dialog.current?.close()}>Done</button>
        </div>
      </dialog>
    );
  }

  return (
    <dialog ref={dialog} className="pa-dialog" onClose={onClose} aria-labelledby="add-title">
      <form onSubmit={submit} noValidate>
        <h2 id="add-title" className="pa-dialog__title">Add institution</h2>
        <p className="pa-desc">
          {created
            ? `${created.name} was created with the ID ${created.publicId}, but its first account was not. Fix the details below and try again; the institution is not created twice.`
            : "STILL issues the institution ID and the workspace admin's account with a temporary password. The admin then invites the rest of their team."}
        </p>
        <label className="pa-dfield">
          <span className="pa-field-label">Institution name</span>
          <input className="pa-input" value={form.name} disabled={!!created} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Seoul Museum of Art" autoFocus />
        </label>
        <label className="pa-dfield">
          <span className="pa-field-label">Short code (2–6 letters)</span>
          <input className="pa-input" value={form.code} disabled={!!created} maxLength={6} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^a-z]/gi, "") })} placeholder="e.g. SEMA" />
          <span className="pa-hint">ID will look like STL-{code}-#### (the number is assigned on save and never reused).</span>
        </label>
        <label className="pa-dfield">
          <span className="pa-field-label">Workspace admin name</span>
          <input className="pa-input" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} placeholder="e.g. Dana Curator" />
        </label>
        <label className="pa-dfield">
          <span className="pa-field-label">Workspace admin email</span>
          <input className="pa-input" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="name@institution.org" />
        </label>
        {error && <p className="pa-alert pa-alert--error" role="alert">{error}</p>}
        <div className="pa-dialog__actions">
          <button type="button" className="pa-btn pa-btn--secondary" onClick={() => dialog.current?.close()}>{created ? "Close" : "Cancel"}</button>
          <button type="submit" className="pa-btn pa-btn--primary" disabled={busy}>{busy ? "Creating…" : created ? "Issue account" : "Create institution"}</button>
        </div>
      </form>
    </dialog>
  );
}
