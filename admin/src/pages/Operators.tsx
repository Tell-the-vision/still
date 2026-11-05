import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { api, type Account } from "../api";
import { useAuth } from "../auth";
import { Shell } from "../Shell";
import { ACCOUNT_STATUS, Confirm, Dot, TemporaryPassword, messageOf, since } from "../ui";

// STILL's own operators (SPEC §9.2, admin.account.* with role ADMIN). Museum staff are listed under their institution.

type Issued = { accountId: string; email: string; password: string };
const nameOf = (a: Account) => a.name ?? a.email;

export default function Operators() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me } = useAuth();
  const [operators, setOperators] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);

  useEffect(() => { api.listAccounts({ role: "ADMIN" }).then(setOperators).catch((e) => setLoadError(messageOf(e))); }, []);

  const sorted = useMemo(() => [...(operators ?? [])].sort((a, b) => nameOf(a).localeCompare(nameOf(b))), [operators]);
  const creating = id === "new";
  const selected = creating || !id ? null : sorted.find((a) => a.id === id) ?? null;
  useEffect(() => { if (!id && sorted.length) navigate(`/operators/${sorted[0].id}`, { replace: true }); }, [id, sorted, navigate]);

  const rail = (
    <>
      {loadError && <p className="pa-rail__note pa-rail__note--error" role="alert">{loadError}</p>}
      {!operators && !loadError && <p className="pa-rail__note">Loading…</p>}
      <ul className="pa-list" aria-label="Operators">
        {sorted.map((a) => (
          <li key={a.id}>
            <NavLink to={`/operators/${a.id}`} className="pa-row">
              <Dot status={a.status} />
              <span className="pa-row__text">
                <span className="pa-row__title">{nameOf(a)}</span>
                <span className="pa-row__meta">{a.name ? a.email : "Operator"}<span className="sr-only">, {ACCOUNT_STATUS[a.status]}</span></span>
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
      <NewOperator
        onCancel={() => navigate("/operators")}
        onIssued={(account, password) => {
          setOperators((l) => [...(l ?? []), account]);
          setIssued({ accountId: account.id, email: account.email, password });
          navigate(`/operators/${account.id}`);
        }}
      />
    );
  } else if (selected) {
    page = (
      <OperatorDetail
        key={selected.id}
        account={selected}
        self={me?.email.toLowerCase() === selected.email.toLowerCase()}
        issued={issued?.accountId === selected.id ? issued : null}
        onIssued={(email, password) => setIssued({ accountId: selected.id, email, password })}
        onDismissIssued={() => setIssued(null)}
        onChange={(a) => setOperators((l) => (l ?? []).map((x) => (x.id === a.id ? a : x)))}
        onRemoved={() => { setOperators((l) => (l ?? []).filter((x) => x.id !== selected.id)); navigate("/operators"); }}
      />
    );
  } else if (operators && id) {
    page = (
      <div className="pa-detail">
        <h1 className="pa-title">Operator not found</h1>
        <p className="pa-lede">Pick someone from the list.</p>
      </div>
    );
  }

  return <Shell section="operators" rail={rail}>{page}</Shell>;
}

function OperatorDetail({ account, self, issued, onIssued, onDismissIssued, onChange, onRemoved }: {
  account: Account;
  self: boolean;
  issued: Issued | null;
  onIssued: (email: string, password: string) => void;
  onDismissIssued: () => void;
  onChange: (a: Account) => void;
  onRemoved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState<"reset" | "delete" | null>(null);
  const suspended = account.status === "SUSPENDED";
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    setAsking(null);
    try { await fn(); } catch (e) { setError(messageOf(e)); }
  };

  return (
    <article className="pa-detail" aria-labelledby="operator-title">
      <p className="pa-status">
        <Dot status={account.status} />
        <span>{ACCOUNT_STATUS[account.status]}</span>
        <span aria-hidden>·</span>
        <span>Operator</span>
      </p>
      <h1 id="operator-title" className="pa-title">{nameOf(account)}</h1>
      <dl className="pa-fields">
        <div><dt>Email</dt><dd>{account.email}</dd></div>
        <div><dt>Last sign-in</dt><dd>{since(account.lastSignInAt, "Never signed in")}</dd></div>
      </dl>

      {error && <p className="pa-error" role="alert">{error} <button type="button" className="pa-link" onClick={() => setError(null)}>Dismiss</button></p>}
      {notice && <p className="pa-notice" role="status">{notice}</p>}
      {issued && <TemporaryPassword email={issued.email} password={issued.password} onDismiss={onDismissIssued} />}

      <div className="pa-actions">
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
            {/* Resetting your own password would end your own session. */}
            <button type="button" className="pa-btn pa-btn--secondary" aria-label={`Reset password for ${account.email}`} disabled={self} onClick={() => setAsking("reset")}>Reset password</button>
            <button type="button" className="pa-btn pa-btn--secondary" aria-label={`${suspended ? "Reactivate" : "Suspend"} ${account.email}`}
              onClick={() => run(async () => {
                onChange(await api.setAccountStatus(account.id, suspended ? "ACTIVE" : "SUSPENDED"));
                setNotice(`${account.email} is ${suspended ? "reactivated" : "suspended"}.`);
              })}>
              {suspended ? "Reactivate" : "Suspend"}
            </button>
            <button type="button" className="pa-link pa-link--danger" aria-label={`Delete ${account.email}`} onClick={() => setAsking("delete")}>Delete</button>
          </>
        )}
      </div>
      {self && <p className="pa-hint pa-detail__hint">This is your account, so its password cannot be reset here.</p>}
    </article>
  );
}

/** Operators run this admin. STILL issues their account with a temporary password, shown once. */
function NewOperator({ onIssued, onCancel }: { onIssued: (account: Account, password: string) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { account, temporaryPassword } = await api.addOperator(form.name.trim(), form.email.trim());
      onIssued(account, temporaryPassword);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };
  return (
    <form className="pa-detail" onSubmit={submit} aria-labelledby="operator-new-title">
      <h1 id="operator-new-title" className="pa-title">New operator</h1>
      <p className="pa-lede">Operators manage STILL's institutions and team. Their temporary password is shown once.</p>
      <div className="pa-fields">
        <div><label htmlFor="op-name">Name</label><input id="op-name" className="pa-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
        <div><label htmlFor="op-email">Email</label><input id="op-email" className="pa-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@still.app" /></div>
      </div>
      {error && <p className="pa-error" role="alert">{error}</p>}
      <div className="pa-actions">
        <button type="submit" className="pa-btn pa-btn--primary" disabled={busy}>{busy ? "Issuing…" : "Issue account"}</button>
        <button type="button" className="pa-link" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
