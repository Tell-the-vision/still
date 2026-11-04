import { useEffect, useState, type FormEvent } from "react";
import { api, type Me, type Member, type MemberRole, type Venue, type WorkspaceSettings } from "../api";
import { VISITOR_HOST } from "../format";
import { useWorkspace } from "../store";
import { Badge, EmptyState, PageHead } from "../ui";

const ROLES: { value: MemberRole; label: string; hint: string }[] = [
  { value: "ADMIN", label: "Admin", hint: "Settings, team and publishing" },
  { value: "CURATOR", label: "Curator", hint: "Review, approve and publish" },
  { value: "EDITOR", label: "Editor", hint: "Upload and edit drafts" },
];
const LANGUAGES: { value: WorkspaceSettings["guideLanguage"]; label: string }[] = [
  { value: "ko+en", label: "Korean + English" },
  { value: "ko", label: "Korean" },
  { value: "en", label: "English" },
];
const PUBLISHING: { key: keyof WorkspaceSettings["publishing"]; title: string; detail: string }[] = [
  { key: "requireRightsConfirmation", title: "Require rights confirmation", detail: "Curators must confirm content rights before publishing an exhibition." },
  { key: "allowVisitorScrap", title: "Allow visitors to save guide sentences", detail: "Visitors can keep approved sentences in their personal archive." },
  { key: "ambienceDefaultOn", title: "Start STILL Ambience on by default", detail: "Used only when an exhibition has no external playlist. Visitors can turn it off." },
];
const roleLabel = (r: MemberRole) => ROLES.find((x) => x.value === r)?.label ?? r;
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Settings() {
  const { reloadWorkspace, reportError } = useWorkspace();
  const [me, setMe] = useState<Me | null>(null);
  const [saved, setSaved] = useState<WorkspaceSettings | null>(null);
  const [form, setForm] = useState<WorkspaceSettings | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getMe(), api.getWorkspaceSettings(), api.listVenues(), api.listMembers()])
      .then(([m, s, v, team]) => { setMe(m); setSaved(s); setForm(s); setVenues(v); setMembers(team); })
      .catch(reportError)
      .finally(() => setLoading(false));
    // Load once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = (msg: string) => { setFlash(msg); window.setTimeout(() => setFlash(null), 2200); };
  const guard = async <T,>(fn: () => Promise<T>) => { try { return await fn(); } catch (e) { reportError(e); return undefined; } };

  if (loading) return <p className="loading">Loading…</p>;
  if (!form || !saved || !me) return <EmptyState title="Settings are unavailable" body="Try again in a moment." />;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const isAdmin = me.role === "ADMIN";

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    const next = await guard(() => api.updateWorkspaceSettings(form));
    setSaving(false);
    if (next) { setSaved(next); setForm(next); reloadWorkspace(); show("Settings saved"); }
  };

  const signOut = async () => {
    await guard(() => api.signOut());
    show("Signed out");
  };

  return (
    <>
      <PageHead
        eyebrow={<>Account <span aria-hidden>/</span> Workspace</>}
        title="Workspace settings"
        lede="Manage your museum profile, team access and publishing defaults."
        actions={
          <>
            <button type="button" className="btn btn--secondary btn--wide" onClick={() => setForm(saved)} aria-disabled={!dirty}>Discard changes</button>
            <button type="button" className="btn btn--primary btn--xwide" onClick={save} aria-disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        <div className="page-head__badge">
          {dirty ? <Badge tone="amber" className="badge--wide">Unsaved changes</Badge> : <Badge tone="green" className="badge--wide">All changes saved</Badge>}
        </div>
      </PageHead>
      {flash && <p className="flash" role="status">{flash}</p>}
      <hr className="rule" />

      {/* Profile + account */}
      <div className="split split--publish">
        <section>
          <h2 className="h2 section__title">Museum profile</h2>
          <label className="field field--stack">
            <span className="field__label">Institution name</span>
            <input className="input input--tall" value={form.institutionName} disabled={!isAdmin} onChange={(e) => setForm({ ...form, institutionName: e.target.value })} />
          </label>
          <label className="field field--stack">
            <span className="field__label">Visitor guide address</span>
            <span className="input-prefix">
              <span className="input-prefix__text">{VISITOR_HOST}</span>
              <input className="input input--tall" value="{exhibition}" readOnly aria-readonly />
            </span>
            <span className="caption-sm">Each exhibition sets its own address when it is published.</span>
          </label>
          <label className="field field--stack">
            <span className="field__label">Guide language</span>
            <select className="input input--tall" value={form.guideLanguage} disabled={!isAdmin} onChange={(e) => setForm({ ...form, guideLanguage: e.target.value as WorkspaceSettings["guideLanguage"] })}>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
        </section>

        <section>
          <h2 className="h2 section__title">Your account</h2>
          <div className="info-card info-card--account">
            <p className="strong">{me.name}</p>
            <p className="caption-sm">{me.email}</p>
            <div className="account__row">
              <Badge>{roleLabel(me.role)}</Badge>
              <button type="button" className="btn btn--secondary" onClick={signOut}>Sign out</button>
            </div>
          </div>
          <div className="info-card info-card--short">
            <p className="strong">Access</p>
            <p className="caption-sm">Only people invited to this workspace can sign in. Roles decide who can edit, approve and publish.</p>
          </div>
        </section>
      </div>

      <Venues venues={venues} canEdit={isAdmin} onAdd={async (v) => {
        const created = await guard(() => api.createVenue(v));
        if (created) { setVenues((l) => [...l, created]); show(`${created.name} added`); }
        return !!created;
      }} />

      <Team
        me={me}
        members={members}
        canEdit={isAdmin}
        onInvite={async (email, role) => {
          const m = await guard(() => api.inviteMember(email, role));
          if (m) { setMembers((l) => [...l, m]); show(`Invitation sent to ${email}`); }
          return !!m;
        }}
        onRole={async (id, role) => {
          const m = await guard(() => api.updateMemberRole(id, role));
          if (m) setMembers((l) => l.map((x) => (x.id === id ? m : x)));
        }}
        onRemove={async (id) => {
          const ok = await guard(async () => { await api.removeMember(id); return true; });
          if (ok) setMembers((l) => l.filter((x) => x.id !== id));
        }}
      />

      <section className="section">
        <h2 className="h2 section__title">Publishing defaults</h2>
        <p className="caption-sm section__lede">Applied to every exhibition in this workspace.</p>
        <ul className="check-list check-list--settings">
          {PUBLISHING.map((p) => (
            <li key={p.key}>
              <div>
                <p className="strong">{p.title}</p>
                <p className="caption-sm">{p.detail}</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.publishing[p.key]}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, publishing: { ...form.publishing, [p.key]: e.target.checked } })}
                />
                <span>{form.publishing[p.key] ? "On" : "Off"}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Venues({ venues, canEdit, onAdd }: { venues: Venue[]; canEdit: boolean; onAdd: (v: Omit<Venue, "id">) => Promise<boolean> }) {
  const [draft, setDraft] = useState({ name: "", city: "", code: "" });
  const [codeTouched, setCodeTouched] = useState(false);
  const code = codeTouched ? draft.code : slug(draft.name);
  const valid = draft.name.trim() && draft.city.trim() && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(code);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if (await onAdd({ name: draft.name.trim(), city: draft.city.trim(), code })) {
      setDraft({ name: "", city: "", code: "" });
      setCodeTouched(false);
    }
  };

  return (
    <section className="section">
      <div className="section__head section__head--plain">
        <h2 className="h2">Venues</h2>
        <span className="caption">{venues.length} venues</span>
      </div>
      {venues.length === 0 ? (
        <EmptyState title="No venues yet" body="Add the galleries where your exhibitions take place." />
      ) : (
        <div className="table-wrap">
          <table className="table table--venues">
            <thead><tr><th>Venue</th><th>City</th><th>Code</th></tr></thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}><td className="strong">{v.name}</td><td className="muted">{v.city}</td><td className="muted mono">{v.code}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <form className="inline-form" onSubmit={submit}>
          <label className="field"><span className="field__label">Venue name</span><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. MMCA Gwacheon" /></label>
          <label className="field"><span className="field__label">City</span><input className="input" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="e.g. Gwacheon" /></label>
          <label className="field"><span className="field__label">Code</span><input className="input mono" value={code} onChange={(e) => { setCodeTouched(true); setDraft({ ...draft, code: e.target.value }); }} placeholder="mmca-gwacheon" /></label>
          <button type="submit" className="btn btn--secondary" aria-disabled={!valid}>+ Add venue</button>
        </form>
      )}
    </section>
  );
}

function Team({
  me, members, canEdit, onInvite, onRole, onRemove,
}: {
  me: Me;
  members: Member[];
  canEdit: boolean;
  onInvite: (email: string, role: MemberRole) => Promise<boolean>;
  onRole: (id: string, role: MemberRole) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("CURATOR");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (valid && (await onInvite(email.trim(), role))) setEmail("");
  };

  return (
    <section className="section">
      <div className="section__head section__head--plain">
        <h2 className="h2">Team</h2>
        <span className="caption">{members.filter((m) => m.status === "ACTIVE").length} active · {members.filter((m) => m.status === "INVITED").length} invited</span>
      </div>
      <div className="table-wrap">
        <table className="table table--team">
          <thead><tr><th>Member</th><th>Role</th><th>Status</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {members.map((m) => {
              const self = m.id === me.id;
              return (
                <tr key={m.id}>
                  <td>
                    <p className="strong">{m.name ?? "Pending invite"}{self && <span className="muted"> (you)</span>}</p>
                    <p className="caption-sm">{m.email}</p>
                  </td>
                  <td>
                    {canEdit && !self ? (
                      <select className="input input--compact" value={m.role} aria-label={`Role for ${m.email}`} onChange={(e) => onRole(m.id, e.target.value as MemberRole)}>
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      <span className="strong-light">{roleLabel(m.role)}</span>
                    )}
                  </td>
                  <td>{m.status === "ACTIVE" ? <Badge tone="green" className="badge--status">Active</Badge> : <Badge tone="amber" className="badge--status">Invited</Badge>}</td>
                  <td className="cell-action cell-action--wide">
                    {canEdit && !self && (
                      confirmId === m.id ? (
                        <span className="confirm">
                          <button type="button" className="link-btn link-btn--danger" onClick={() => { setConfirmId(null); onRemove(m.id); }}>Remove</button>
                          <button type="button" className="link-btn" onClick={() => setConfirmId(null)}>Cancel</button>
                        </span>
                      ) : (
                        <button type="button" className="link-btn" onClick={() => setConfirmId(m.id)}>{m.status === "INVITED" ? "Cancel invite" : "Remove"}</button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <form className="inline-form inline-form--invite" onSubmit={submit}>
          <label className="field"><span className="field__label">Invite by email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@museum.org" /></label>
          <label className="field">
            <span className="field__label">Role</span>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.hint}</option>)}
            </select>
          </label>
          <button type="submit" className="btn btn--primary" aria-disabled={!valid}>Send invite</button>
        </form>
      )}
    </section>
  );
}
