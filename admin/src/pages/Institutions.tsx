import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { api, type Account, type Institution } from "../api";
import { AccountNotIssuedError } from "../api/errors";
import { Shell } from "../Shell";
import { ACCOUNT_STATUS, Confirm, Dot, INSTITUTION_STATUS, TemporaryPassword, formatDate, messageOf, since } from "../ui";

// Platform admin A9 (SPEC §9.2): STILL's contract accounts. Each institution is a museum under contract; STILL issues
// its ID (staff type it to sign in, Figma 10) and every one of its staff accounts. The accounts are listed in the
// rail; the one picked opens beside it with its staff and the few things an operator does to it.

/** A temporary password just issued, shown once on the institution it belongs to. */
type Issued = { institutionId: string; email: string; password: string };
/** The institution was created but its first account was not: its page opens on the account form, filled in. */
type Unissued = { institutionId: string; name: string; email: string; error: string };

export default function Institutions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState<Institution[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [unissued, setUnissued] = useState<Unissued | null>(null);

  useEffect(() => { api.listInstitutions().then(setList).catch((e) => setLoadError(messageOf(e))); }, []);

  const sorted = useMemo(() => [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [list]);
  const q = query.trim().toLowerCase();
  const shown = q ? sorted.filter((i) => i.name.toLowerCase().includes(q) || i.publicId.toLowerCase().includes(q)) : sorted;
  const creating = id === "new";
  const selected = creating || !id ? null : sorted.find((i) => i.id === id) ?? null;

  // Without an id in the address the first account opens; replace, so Back does not return to an empty page.
  useEffect(() => { if (!id && sorted.length) navigate(`/institutions/${sorted[0].id}`, { replace: true }); }, [id, sorted, navigate]);

  const upsert = (inst: Institution) => setList((l) => [...(l ?? []).filter((x) => x.id !== inst.id), inst]);

  const rail = (
    <>
      <div className="pa-search">
        <input className="pa-input" type="search" aria-label="Search institutions" placeholder="Search institution name or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {loadError && <p className="pa-rail__note pa-rail__note--error" role="alert">{loadError}</p>}
      {!list && !loadError && <p className="pa-rail__note">Loading…</p>}
      {list && shown.length === 0 && <p className="pa-rail__note">{q ? "No institutions match." : "No institutions yet."}</p>}
      <ul className="pa-list" aria-label="Institutions">
        {shown.map((i) => (
          <li key={i.id}>
            <NavLink to={`/institutions/${i.id}`} className="pa-row">
              <Dot status={i.status} />
              <span className="pa-row__text">
                <span className="pa-row__title">{i.name}</span>
                <span className="pa-row__meta">{i.publicId}<span className="sr-only">, {INSTITUTION_STATUS[i.status]}</span></span>
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </>
  );

  let page = null;
  if (creating) {
    page = (
      <NewInstitution
        all={list ?? []}
        onCancel={() => navigate("/institutions")}
        onCreated={(inst, password) => {
          upsert(inst);
          setIssued({ institutionId: inst.id, email: inst.adminEmail, password });
          navigate(`/institutions/${inst.id}`);
        }}
        onUnissued={(inst, admin, error) => {
          upsert(inst);
          setUnissued({ institutionId: inst.id, ...admin, error });
          navigate(`/institutions/${inst.id}`);
        }}
      />
    );
  } else if (selected) {
    page = (
      <InstitutionDetail
        key={selected.id}
        institution={selected}
        issued={issued?.institutionId === selected.id ? issued : null}
        unissued={unissued?.institutionId === selected.id ? unissued : null}
        onChange={upsert}
        onIssued={(email, password) => setIssued({ institutionId: selected.id, email, password })}
        onDismissIssued={() => setIssued(null)}
        onUnissuedDone={() => setUnissued(null)}
      />
    );
  } else if (list && id) {
    page = (
      <div className="pa-detail">
        <h1 className="pa-title">Institution not found</h1>
        <p className="pa-lede">It is not among STILL's contract accounts. Pick one from the list.</p>
      </div>
    );
  } else if (list && list.length === 0) {
    page = (
      <div className="pa-detail">
        <h1 className="pa-title">No institutions yet</h1>
        <p className="pa-lede">Each museum under contract gets an institution ID and a workspace admin account from STILL.</p>
        <div className="pa-actions"><button type="button" className="pa-btn pa-btn--primary" onClick={() => navigate("/institutions/new")}>New institution</button></div>
      </div>
    );
  }

  return <Shell section="institutions" rail={rail}>{page}</Shell>;
}

function InstitutionDetail({ institution, issued, unissued, onChange, onIssued, onDismissIssued, onUnissuedDone }: {
  institution: Institution;
  issued: Issued | null;
  unissued: Unissued | null;
  onChange: (inst: Institution) => void;
  onIssued: (email: string, password: string) => void;
  onDismissIssued: () => void;
  onUnissuedDone: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(unissued ? `${institution.name} was created, but its first account was not: ${unissued.error}` : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(!!unissued);

  // Oldest first: the first account is the workspace admin (SPEC §9.2).
  useEffect(() => { api.listAccounts({ institutionId: institution.id }).then(setAccounts).catch((e) => setError(messageOf(e))); }, [institution.id]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    try { await fn(); } catch (e) { setError(messageOf(e)); }
  };
  const setAccess = (next: "ACTIVE" | "SUSPENDED") => run(async () => {
    setConfirming(false);
    onChange(await api.setInstitutionStatus(institution.id, next));
    setNotice(next === "SUSPENDED" ? `${institution.name} is suspended. Its staff can no longer sign in; nothing is deleted.` : `${institution.name} is reactivated.`);
  });
  const copyId = () => navigator.clipboard.writeText(institution.publicId).then(
    () => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); },
    () => setError("Could not copy. Select the ID and copy it by hand."),
  );
  const replaceAccount = (a: Account) => setAccounts((l) => (l ?? []).map((x) => (x.id === a.id ? a : x)));

  return (
    <article className="pa-detail" aria-labelledby="institution-title">
      {/* Its status is the dot in the rail; a suspended one also offers Reactivate below. */}
      <p className="pa-status">Onboarded {formatDate(institution.createdAt)}</p>
      {/* What concerns the whole contract account sits with its name: suspend it, or bring it back. */}
      <div className="pa-head">
        <h1 id="institution-title" className="pa-title">{institution.name}</h1>
        {institution.status === "SUSPENDED" ? (
          <button type="button" className="pa-btn pa-btn--primary" onClick={() => setAccess("ACTIVE")}>Reactivate institution</button>
        ) : !confirming && (
          <button type="button" className="pa-btn pa-btn--secondary" title="Signs out all of its staff. Nothing is deleted." onClick={() => setConfirming(true)}>Suspend institution</button>
        )}
      </div>
      {confirming && (
        <p className="pa-head__confirm">
          <Confirm question={`Suspend ${institution.name}? All of its staff are signed out at once; nothing is deleted.`} action="Suspend" danger onConfirm={() => setAccess("SUSPENDED")} onCancel={() => setConfirming(false)} />
        </p>
      )}

      <dl className="pa-fields">
        <div>
          <dt>Institution ID</dt>
          <dd className="pa-inline">
            <span className="pa-code">{institution.publicId}</span>
            <button type="button" className="pa-link" onClick={copyId}>{copied ? "Copied" : "Copy"}</button>
          </dd>
        </div>
        <div><dt>Last active</dt><dd>{since(institution.lastActiveAt, "No one has signed in yet")}</dd></div>
      </dl>

      {error && <p className="pa-error" role="alert">{error} <button type="button" className="pa-link" onClick={() => setError(null)}>Dismiss</button></p>}
      {notice && <p className="pa-notice" role="status">{notice}</p>}
      {issued && <TemporaryPassword email={issued.email} password={issued.password} onDismiss={onDismissIssued} />}

      <section className="pa-section" aria-labelledby="staff-title">
        <div className="pa-section__head">
          <h2 id="staff-title" className="pa-h2">Staff accounts</h2>
          {/* The form opens and closes from the same place. */}
          <button type="button" className="pa-link" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Issue an account"}</button>
        </div>
        {adding && (
          <IssueAccount
            institutionId={institution.id}
            initial={unissued ? { name: unissued.name, email: unissued.email } : undefined}
            onIssued={(account, password) => {
              setAccounts((l) => [...(l ?? []), account]);
              setAdding(false);
              setError(null);
              onUnissuedDone();
              // The first account is the workspace admin; the list shows it from now on.
              if (institution.adminEmail === "—") onChange({ ...institution, adminEmail: account.email });
              onIssued(account.email, password);
            }}
          />
        )}
        {!accounts && <p className="pa-quiet">Loading…</p>}
        {accounts?.length === 0 && !adding && <p className="pa-quiet">No accounts yet. Issue the workspace admin's account to finish setting up.</p>}
        <ul className="pa-accounts" aria-label={`Staff of ${institution.name}`}>
          {accounts?.map((a, n) => (
            <StaffAccount
              key={a.id}
              account={a}
              workspaceAdmin={n === 0}
              onChange={replaceAccount}
              onRemoved={() => setAccounts((l) => (l ?? []).filter((x) => x.id !== a.id))}
              onIssued={onIssued}
              onError={setError}
            />
          ))}
        </ul>
      </section>

    </article>
  );
}

/** One staff account of an institution, with what an operator does for it: a new password, a pause, removal. */
function StaffAccount({ account, workspaceAdmin, onChange, onRemoved, onIssued, onError }: {
  account: Account;
  workspaceAdmin: boolean;
  onChange: (a: Account) => void;
  onRemoved: () => void;
  onIssued: (email: string, password: string) => void;
  onError: (message: string | null) => void;
}) {
  const [asking, setAsking] = useState<"reset" | "delete" | null>(null);
  const suspended = account.status === "SUSPENDED";
  const run = async (fn: () => Promise<void>) => {
    onError(null);
    setAsking(null);
    try { await fn(); } catch (e) { onError(messageOf(e)); }
  };
  const meta = [account.name ? account.email : null, workspaceAdmin ? "Workspace admin" : null].filter(Boolean).join(" · ");

  return (
    <li className="pa-account-row">
      <span className="pa-account-row__who">
        <span className="pa-account-row__line">
          <span className="pa-strong">{account.name ?? account.email}</span>
          <span className="pa-account-row__state">
            <Dot status={account.status} />
            {ACCOUNT_STATUS[account.status]} · {since(account.lastSignInAt, "Never signed in")}
          </span>
        </span>
        {meta && <span className="pa-meta">{meta}</span>}
      </span>
      <span className="pa-account-row__actions">
        {asking === "reset" ? (
          <Confirm
            question={`Reset ${account.email}'s password? They are signed out.`}
            action="Reset password"
            onConfirm={() => run(async () => { const r = await api.resetAccountPassword(account.id); onIssued(r.email, r.temporaryPassword); })}
            onCancel={() => setAsking(null)}
          />
        ) : asking === "delete" ? (
          <Confirm
            question={`Delete ${account.email}? This cannot be undone.`}
            action="Confirm delete"
            danger
            onConfirm={() => run(async () => { await api.deleteAccount(account.id); onRemoved(); })}
            onCancel={() => setAsking(null)}
          />
        ) : (
          <>
            <button type="button" className="pa-link" aria-label={`Reset password for ${account.email}`} onClick={() => setAsking("reset")}>Reset password</button>
            <button type="button" className="pa-link" aria-label={`${suspended ? "Reactivate" : "Suspend"} ${account.email}`}
              onClick={() => run(async () => onChange(await api.setAccountStatus(account.id, suspended ? "ACTIVE" : "SUSPENDED")))}>
              {suspended ? "Reactivate" : "Suspend"}
            </button>
            <button type="button" className="pa-link pa-link--danger" aria-label={`Delete ${account.email}`} onClick={() => setAsking("delete")}>Delete</button>
          </>
        )}
      </span>
    </li>
  );
}

/** STILL issues every account (no invitations, SPEC §9.2): a name and an email, then a temporary password shown once. */
function IssueAccount({ institutionId, initial, onIssued }: {
  institutionId: string;
  initial?: { name: string; email: string };
  onIssued: (account: Account, password: string) => void;
}) {
  const [form, setForm] = useState(initial ?? { name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { account, temporaryPassword } = await api.issueInstitutionAccount(institutionId, form.name.trim(), form.email.trim());
      onIssued(account, temporaryPassword);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };
  return (
    <form className="pa-inline-form" onSubmit={submit}>
      <label className="pa-field"><span className="pa-field-label">Name</span><input className="pa-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></label>
      <label className="pa-field"><span className="pa-field-label">Email</span><input className="pa-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@institution.org" /></label>
      <button type="submit" className="pa-btn pa-btn--primary" disabled={busy}>{busy ? "Issuing…" : "Issue account"}</button>
      {error && <p className="pa-error pa-inline-form__error" role="alert">{error}</p>}
    </form>
  );
}

/** A new contract account: its name and short code, and its workspace admin, whose account is issued with it. */
function NewInstitution({ all, onCreated, onUnissued, onCancel }: {
  all: Institution[];
  onCreated: (inst: Institution, password: string) => void;
  onUnissued: (inst: Institution, admin: { name: string; email: string }, error: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ name: "", code: "", adminName: "", adminEmail: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]); // a failed submit moves focus to the message
  const invalid = error ? { "aria-invalid": true, "aria-describedby": "new-error" } : {};
  const code = form.code.trim().toUpperCase() || "CODE";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { institution, temporaryPassword } = await api.createInstitution(form, all);
      onCreated(institution, temporaryPassword);
    } catch (err) {
      // The institution exists, only its account step failed: finish that on the institution's own page.
      if (err instanceof AccountNotIssuedError) onUnissued(err.institution, { name: form.adminName, email: form.adminEmail }, err.message);
      else { setError(messageOf(err)); setBusy(false); }
    }
  };

  return (
    <form className="pa-detail" onSubmit={submit} noValidate aria-labelledby="new-title">
      <h1 id="new-title" className="pa-title">New institution</h1>
      <p className="pa-lede">STILL issues the institution ID and its workspace admin's account. The temporary password is shown once.</p>
      <div className="pa-fields">
        <div>
          <label htmlFor="new-name">Institution name</label>
          <input id="new-name" className="pa-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Seoul Museum of Art" autoFocus {...invalid} />
        </div>
        <div>
          <label htmlFor="new-code">Short code (2–6 letters)</label>
          <span className="pa-stack">
            <input id="new-code" className="pa-input pa-input--code" value={form.code} maxLength={6} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^a-z]/gi, "") })} placeholder="SEMA" aria-describedby="new-code-hint" {...invalid} />
            <span id="new-code-hint" className="pa-hint">The ID will be STL-{code}-####. The number is assigned on save and never reused.</span>
          </span>
        </div>
        <div>
          <label htmlFor="new-admin">Workspace admin name</label>
          <input id="new-admin" className="pa-input" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} placeholder="e.g. Dana Curator" {...invalid} />
        </div>
        <div>
          <label htmlFor="new-email">Workspace admin email</label>
          <input id="new-email" className="pa-input" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="name@institution.org" {...invalid} />
        </div>
      </div>
      {error && <p id="new-error" ref={errorRef} tabIndex={-1} className="pa-error" role="alert">{error}</p>}
      <div className="pa-actions">
        <button type="submit" className="pa-btn pa-btn--primary" disabled={busy}>{busy ? "Creating…" : "Create institution"}</button>
        <button type="button" className="pa-link" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
