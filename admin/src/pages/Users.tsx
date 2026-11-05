import { useEffect, useState, type FormEvent } from "react";
import { api, type Account } from "../api";

// TEMPORARY (임시) Users & access screen: STILL staff accounts (SPEC §9.2, admin.account.*). Not designed in Figma yet.

const messageOf = (e: unknown) => {
  if (e && typeof e === "object" && "appCode" in e && e.appCode === "LAST_ADMIN") return "STILL must keep at least one active operator, so this account cannot be suspended or deleted.";
  return e instanceof Error ? e.message : String(e);
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "—");

export default function Users() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.listAccounts().then(setAccounts).catch((e) => setError(messageOf(e))); }, []);

  const act = async (fn: () => Promise<void>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(messageOf(e)); }
  };
  const show = (email: string, password: string) => { setIssued({ email, password }); setCopied(false); setNotice(null); };
  const replace = (a: Account) => setAccounts((l) => (l ?? []).map((x) => (x.id === a.id ? a : x)));

  const setStatus = (a: Account) => act(async () => {
    const next = a.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    replace(await api.setAccountStatus(a.id, next));
    setNotice(`${a.email} is ${next === "ACTIVE" ? "reactivated" : "suspended"}.`);
  });
  const reset = (a: Account) => act(async () => {
    const { email, temporaryPassword } = await api.resetAccountPassword(a.id);
    show(email, temporaryPassword);
  });
  const remove = (a: Account) => act(async () => {
    await api.deleteAccount(a.id);
    setAccounts((l) => (l ?? []).filter((x) => x.id !== a.id));
    setDeleting(null);
    setNotice(`${a.email} is deleted.`);
  });
  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    return act(async () => {
      const { account, temporaryPassword } = await api.addOperator(String(form.get("name")).trim(), String(form.get("email")).trim());
      setAccounts((l) => [...(l ?? []), account]);
      setAdding(false);
      show(account.email, temporaryPassword);
    });
  };
  const copy = () => navigator.clipboard.writeText(issued!.password).then(() => setCopied(true), () => setError("Copy failed. Select the password and copy it."));

  return (
    <div className="pa-page">
      <div className="pa-head">
        <div>
          <p className="pa-crumb">Platform admin&nbsp;&nbsp;/&nbsp;&nbsp;Users &amp; access</p>
          <h1 className="pa-title">Users &amp; access</h1>
          <p className="pa-desc">Operators and institution staff who can sign in.</p>
          <p className="pa-signin__temp">Temporary screen (임시) · not designed yet</p>
        </div>
        <button type="button" className="pa-btn pa-btn--primary pa-head__action" onClick={() => setAdding(true)}>Add operator</button>
      </div>

      {adding && (
        <form className="pa-adding" onSubmit={add}>
          <label className="pa-search"><span className="pa-field-label">Name</span><input className="pa-input" name="name" required /></label>
          <label className="pa-search"><span className="pa-field-label">Email</span><input className="pa-input" name="email" type="email" required /></label>
          <button type="submit" className="pa-btn pa-btn--primary">Issue account</button>
          <button type="button" className="pa-btn pa-btn--secondary" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      )}

      {error && <p className="pa-alert pa-alert--error" role="alert">{error} <button type="button" className="pa-link" onClick={() => setError(null)}>Dismiss</button></p>}
      {issued && (
        <div className="pa-alert pa-secret" role="status">
          <p>Temporary password for {issued.email}. They are signed out and must change it at their next sign-in.</p>
          <p className="pa-secret__row">
            <code className="pa-secret__code">{issued.password}</code>
            <button type="button" className="pa-btn pa-btn--secondary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            <button type="button" className="pa-link" onClick={() => setIssued(null)}>Dismiss</button>
          </p>
          <p>This password is shown only once. Pass it on now.</p>
        </div>
      )}
      {notice && <p className="pa-alert" role="status">{notice} <button type="button" className="pa-link" onClick={() => setNotice(null)}>Dismiss</button></p>}

      <div className="pa-table" role="table" aria-label="Accounts">
        <div className="pa-tr pa-tr--accounts pa-tr--head" role="row">
          {["Role", "Institution", "Email", "Name", "Status", "Last sign-in", "Actions"].map((h) => <span key={h} role="columnheader">{h}</span>)}
        </div>
        {!accounts && !error && <p className="pa-empty">Loading…</p>}
        {accounts?.length === 0 && <p className="pa-empty">No accounts.</p>}
        {accounts?.map((a) => (
          <div key={a.id} className="pa-tr pa-tr--accounts" role="row">
            <span role="cell">{a.role === "ADMIN" ? "Operator" : "Institution"}</span>
            <span role="cell">{a.institution ?? "—"}</span>
            <span role="cell" className="pa-td-name">{a.email}</span>
            <span role="cell">{a.name ?? "—"}</span>
            <span role="cell"><span className={`pa-badge pa-badge--${a.status.toLowerCase()}`}>{a.status === "ACTIVE" ? "Active" : "Suspended"}</span></span>
            <span role="cell">{day(a.lastSignInAt)}</span>
            <span role="cell" className="pa-actions">
              {deleting === a.id ? (
                <>
                  <span>Delete {a.email}? This cannot be undone.</span>
                  <button type="button" className="pa-link pa-link--danger" onClick={() => remove(a)}>Confirm delete</button>
                  <button type="button" className="pa-link" onClick={() => setDeleting(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <button type="button" className="pa-link" aria-label={`${a.status === "ACTIVE" ? "Suspend" : "Reactivate"} ${a.email}`} onClick={() => setStatus(a)}>{a.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button>
                  <button type="button" className="pa-link" aria-label={`Reset password for ${a.email}`} onClick={() => reset(a)}>Reset password</button>
                  <button type="button" className="pa-link pa-link--danger" aria-label={`Delete ${a.email}`} onClick={() => setDeleting(a.id)}>Delete</button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
