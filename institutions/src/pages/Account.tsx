import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type NotificationPrefs } from "../api";
import { ROLES } from "../rules";
import { useWorkspace } from "../store";
import { Arrow, Badge, EmptyState, PageHead } from "../ui";

const NOTIFS: { key: keyof NotificationPrefs; title: string; detail: string }[] = [
  { key: "analysisComplete", title: "Analysis finished", detail: "Email me when STILL finishes reading uploaded files." },
  { key: "reviewNeeded", title: "Items waiting for review", detail: "Email me when content needs my review or approval." },
  { key: "weeklyDigest", title: "Weekly summary", detail: "A short email every Monday about this workspace." },
];

/** ACCOUNT: the signed-in person. Museum-level settings live in Workspace settings. */
export default function Account() {
  const { me, workspace, updateMe, signOut, reportError } = useWorkspace();
  const [name, setName] = useState(me?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => { setName(me?.name ?? ""); }, [me]);
  useEffect(() => {
    api.getNotificationPrefs().then(setPrefs).catch(reportError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!me) return <EmptyState title="Account unavailable" body="Sign in again to manage your account." />;

  const show = (msg: string) => { setFlash(msg); window.setTimeout(() => setFlash(null), 2000); };
  const nameDirty = name.trim() !== me.name && name.trim().length > 0;

  const saveName = async () => {
    if (!nameDirty || savingName) return;
    setSavingName(true);
    try { await updateMe({ name: name.trim() }); show("Name updated"); } catch { /* error banner */ } finally { setSavingName(false); }
  };

  const toggle = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value }); // optimistic
    try {
      setPrefs(await api.updateNotificationPrefs({ [key]: value }));
    } catch (e) {
      setPrefs(prefs);
      reportError(e);
    }
  };

  const doSignOut = async () => {
    try { await signOut(); setSignedOut(true); } catch { /* error banner */ }
  };

  const role = ROLES[me.role];

  return (
    <>
      <PageHead
        eyebrow="Account"
        title="Your account"
        lede="Your profile, role and notifications. Museum-wide options are in Workspace settings."
        actions={<button type="button" className="btn btn--secondary btn--wide" onClick={doSignOut}>{signedOut ? "Signed out" : "Sign out"}</button>}
      />
      {flash && <p className="flash" role="status">{flash}</p>}
      <hr className="rule" />

      <div className="split split--publish">
        <section>
          <h2 className="h2 section__title">Profile</h2>
          <label className="field field--stack">
            <span className="field__label">Name</span>
            <span className="input-action">
              <input className="input input--tall" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} />
              <button type="button" className="btn btn--primary" aria-disabled={!nameDirty || savingName} onClick={saveName}>{savingName ? "Saving…" : "Save"}</button>
            </span>
          </label>
          <label className="field field--stack">
            <span className="field__label">Email</span>
            <input className="input input--tall" value={me.email} readOnly aria-readonly />
            <span className="caption-sm">Your sign-in email. Ask a workspace admin to change it.</span>
          </label>
        </section>

        <section>
          <h2 className="h2 section__title">Role</h2>
          <div className="info-card info-card--account">
            <div className="account__row account__row--top">
              <p className="strong">{workspace?.institutionName}</p>
              <Badge>{role.label}</Badge>
            </div>
            <p className="caption-sm">{role.can}</p>
            {me.role === "CURATOR" && <p className="caption-sm">{me.canPublish ? "You can publish exhibitions." : "Publishing is not enabled for you."}</p>}
          </div>
          <div className="info-card info-card--short">
            <p className="strong">Need a different role?</p>
            <p className="caption-sm">Roles and publishing rights are managed by institution admins.</p>
            <Link to="/settings" className="open-link info-card__link">Workspace settings <Arrow /></Link>
          </div>
        </section>
      </div>

      <section className="section">
        <h2 className="h2 section__title">Email notifications</h2>
        <p className="caption-sm section__lede">Sent to {me.email}.</p>
        {!prefs ? (
          <p className="loading">Loading…</p>
        ) : (
          <ul className="check-list check-list--settings">
            {NOTIFS.map((n) => (
              <li key={n.key}>
                <div>
                  <p className="strong">{n.title}</p>
                  <p className="caption-sm">{n.detail}</p>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={prefs[n.key]} onChange={(e) => toggle(n.key, e.target.checked)} />
                  <span>{prefs[n.key] ? "On" : "Off"}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
