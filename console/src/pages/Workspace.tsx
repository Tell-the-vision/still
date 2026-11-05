import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api, type Exhibition, type Venue } from "../api";
import { AccountMenu } from "../AccountMenu";
import { formatPeriod, libraryStatus, visitorUrl, type LibraryStatus } from "../format";
import { NewExhibitionDialog } from "../NewExhibition";
import { useWorkspace } from "../store";

const STATUS_LABEL: Record<LibraryStatus, string> = { live: "Live", scheduled: "Scheduled", ended: "Ended", draft: "Draft" };

/**
 * Exhibitions (A8, console.exhibition.list): every exhibition of the institution in the rail, and the selected one's
 * high-level decisions on the right: title, subtitle, venue, dates. Its text is written in the editor.
 */
export default function Workspace() {
  const { exhibitions, exhibition, selectExhibition, createExhibition } = useWorkspace();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const list = [...exhibitions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // A new exhibition opens in the editor, ready to write.
  const create = async (input: Parameters<typeof createExhibition>[0]) => {
    await createExhibition(input);
    navigate("/");
  };

  return (
    <div className="doc-layout">
      <nav className="doc-outline" aria-label="Exhibitions">
        <div className="rail-brand">
          <NavLink to="/" className="wordmark">STILL.</NavLink>
          <AccountMenu className="account-menu--rail" />
        </div>
        <NavLink to="/" className="rail-back">← Editor</NavLink>
        <div className="doc-outline__head">
          <span className="eyebrow">Exhibitions</span>
          <button type="button" className="link-btn link-btn--strong" onClick={() => setCreating(true)}>+ New</button>
        </div>
        <div className="rail-scroll">
          <ul className="item-list">
            {list.map((e) => {
              const s = libraryStatus(e);
              return (
                <li key={e.id}>
                  <div className={`item-row${e.id === exhibition?.id ? " is-selected" : ""}`}>
                    <span className={`switcher__dot switcher__dot--${s}`} title={STATUS_LABEL[s]} aria-hidden />
                    <button type="button" className="item" onClick={() => selectExhibition(e.id)}>
                      <span className="item__title">{e.title}</span>
                      <span className="sr-only">{STATUS_LABEL[s]}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <article className="doc" aria-label="Exhibition details">
        {exhibition ? (
          <ExhibitionDetails key={exhibition.id} exhibition={exhibition} />
        ) : (
          <div className="details-empty">
            <p className="strong">No exhibition yet</p>
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>+ New exhibition</button>
          </div>
        )}
      </article>
      {creating && <NewExhibitionDialog onCreate={create} onClose={() => setCreating(false)} />}
    </div>
  );
}

/** The exhibition's details, edited in place; publishing checks them (title, venue, period). */
function ExhibitionDetails({ exhibition }: { exhibition: Exhibition }) {
  const { updateExhibition, reportError } = useWorkspace();
  const navigate = useNavigate();
  const initial = {
    title: exhibition.title,
    subtitle: exhibition.subtitle ?? "",
    venueId: exhibition.venueId ?? "",
    startDate: exhibition.startDate ?? "",
    endDate: exhibition.endDate ?? "",
  };
  const [form, setForm] = useState(initial);
  // What was last saved: the button wakes only when the form differs from it.
  const [baseline, setBaseline] = useState(initial);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [newVenue, setNewVenue] = useState<{ name: string; city: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const status = libraryStatus(exhibition);

  useEffect(() => { api.listVenues().then(setVenues).catch(reportError); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = (Object.keys(baseline) as (keyof typeof baseline)[]).some((k) => form[k] !== baseline[k]);
  const badDates = !!form.startDate && !!form.endDate && form.endDate < form.startDate;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setForm({ ...form, [k]: e.target.value }); };

  const save = async () => {
    if (!dirty || saving || !form.title.trim() || badDates) return;
    setSaving(true);
    try {
      await updateExhibition({
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        venueId: form.venueId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      });
      setBaseline(form);
    } catch { /* error banner */ } finally {
      setSaving(false);
    }
  };
  const addVenue = async () => {
    if (!newVenue?.name.trim() || !newVenue.city.trim()) return;
    try {
      const venue = await api.createVenue({ name: newVenue.name.trim(), city: newVenue.city.trim() });
      setVenues((list) => [...list, venue]);
      setForm({ ...form, venueId: venue.id });
      setNewVenue(null);
    } catch (e) { reportError(e); }
  };

  return (
    <div className="details">
      <p className="details__status">
        <span className={`switcher__dot switcher__dot--${status}`} aria-hidden />
        {STATUS_LABEL[status]} · {formatPeriod(exhibition.startDate, exhibition.endDate)}
      </p>
      <input className="details__title" aria-label="Exhibition title" value={form.title} onChange={set("title")} placeholder="Exhibition title" />
      <input className="details__subtitle" aria-label="Subtitle" value={form.subtitle} onChange={set("subtitle")} placeholder="Subtitle (optional)" />

      <dl className="details__fields">
        <div>
          <dt><label htmlFor="details-venue">Venue</label></dt>
          <dd>
            <select id="details-venue" className="input" value={form.venueId} onChange={set("venueId")}>
              <option value="">Choose a venue…</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.city}</option>)}
            </select>
            {newVenue ? (
              <form className="details__venue-new" onSubmit={(e) => { e.preventDefault(); void addVenue(); }}>
                <input className="input" aria-label="New venue name" autoFocus placeholder="Venue name" value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} />
                <input className="input" aria-label="New venue city" placeholder="City" value={newVenue.city} onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })} />
                <button type="submit" className="btn btn--small btn--secondary">Add</button>
                <button type="button" className="link-btn" onClick={() => setNewVenue(null)}>Cancel</button>
              </form>
            ) : (
              <button type="button" className="link-btn" onClick={() => setNewVenue({ name: "", city: "" })}>+ Add venue</button>
            )}
          </dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd className="details__dates">
            <input className="input" type="date" aria-label="Start date" value={form.startDate} onChange={set("startDate")} />
            <span aria-hidden>–</span>
            <input className="input" type="date" aria-label="End date" value={form.endDate} onChange={set("endDate")} />
            {badDates && <span className="caption-sm error">The end date is before the start date.</span>}
          </dd>
        </div>
        <div>
          <dt>Visitor URL</dt>
          <dd>
            <span className="details__url">{visitorUrl(exhibition.code)}</span>
            <span className="caption-sm">Set when the exhibition was created; it does not change.</span>
          </dd>
        </div>
      </dl>

      <div className="details__actions">
        {/* With nothing unsaved, the editor is the next step; with changes, saving them is. */}
        {dirty ? (
          <>
            <button type="button" className="btn btn--primary" disabled={saving || !form.title.trim() || badDates} onClick={save}>{saving ? "Saving…" : "Save details"}</button>
            <button type="button" className="link-btn" onClick={() => navigate("/")}>Open in editor</button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => navigate("/")}>Open in editor</button>
        )}
        {/* Each live artwork has its own QR, kept with the works. */}
        {exhibition.status === "PUBLISHED" && <NavLink className="link-btn" to={`/exhibitions/${exhibition.code}/works`}>Go to works</NavLink>}
      </div>
    </div>
  );
}
