import { useState, type FormEvent } from "react";
import { useWorkspace } from "../store";
import { EmptyState, PageHead } from "../ui";

/** ACCOUNT: who is signed in (me.get), change password (password.update) and sign out (issue #61). */
export default function Account() {
  const { me, workspace, changePassword, signOut } = useWorkspace();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!me) return <EmptyState title="Account unavailable" body="Sign in again to see your account." />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.current || !form.next) { setMessage({ ok: false, text: "Enter your current password and a new one." }); return; }
    if (form.next !== form.confirm) { setMessage({ ok: false, text: "The new passwords do not match." }); return; }
    setBusy(true);
    setMessage(null);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: "", next: "", confirm: "" });
      setMessage({ ok: true, text: "Password changed. Other devices were signed out." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Account"
        title="Your account"
        lede="Your sign-in details. STILL issues staff accounts; ask STILL support to change your name or email."
        actions={<button type="button" className="btn btn--secondary btn--wide" onClick={() => { signOut().catch(() => {}); }}>Sign out</button>}
      />
      <hr className="rule" />

      <div className="split split--publish">
        <section>
          <h2 className="h2 section__title">Profile</h2>
          <dl className="account-facts">
            <div><dt className="field__label">Name</dt><dd className="strong">{me.name}</dd></div>
            <div><dt className="field__label">Email</dt><dd className="strong">{me.email}</dd></div>
            <div><dt className="field__label">Institution</dt><dd className="strong">{workspace?.institutionName}</dd></div>
            <div><dt className="field__label">Institution ID</dt><dd className="strong mono">{workspace?.institutionId}</dd></div>
          </dl>
        </section>

        <section>
          <h2 className="h2 section__title">Change password</h2>
          <form onSubmit={submit} noValidate>
            <label className="field field--stack">
              <span className="field__label">Current password</span>
              <input className="input input--tall" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
            </label>
            <label className="field field--stack">
              <span className="field__label">New password</span>
              <input className="input input--tall" type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
              <span className="caption-sm">At least 10 characters.</span>
            </label>
            <label className="field field--stack">
              <span className="field__label">New password again</span>
              <input className="input input--tall" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            </label>
            {message && <p className={message.ok ? "flash" : "field-error"} role={message.ok ? "status" : "alert"}>{message.text}</p>}
            <button type="submit" className="btn btn--primary btn--wide" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
          </form>
        </section>
      </div>
    </>
  );
}
