import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Venue } from "../api";
import { VISITOR_HOST } from "../format";
import { blockingAssets, NO_PERMISSION } from "../rules";
import { useWorkspace } from "../store";
import { Badge, NoExhibition, PageHead, Stepper } from "../ui";

export default function Publish() {
  const { exhibition, counts, items, can, updateExhibition, publishExhibition, createExhibition, reportError } = useWorkspace();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({
    title: exhibition?.title ?? "",
    subtitle: exhibition?.subtitle ?? "",
    venueId: exhibition?.venueId ?? "",
    startDate: exhibition?.startDate ?? "",
    endDate: exhibition?.endDate ?? "",
    code: exhibition?.code ?? "",
  }));
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [newVenue, setNewVenue] = useState<{ name: string; city: string } | null>(null);

  useEffect(() => {
    api.listVenues().then(setVenues).catch(reportError);
    // Load once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!exhibition) return <NoExhibition title="Prepare publication" onCreate={createExhibition} />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setSaved(false); setForm({ ...form, [k]: e.target.value }); };
  const missing = !form.title.trim() || !form.venueId || !form.startDate || !form.endDate || !form.code.trim();
  const badDates = !!form.startDate && !!form.endDate && form.endDate < form.startDate;
  // Handoff 4.6 / 12: publish is blocked until metadata, approval and rights checks are complete.
  const allowed = can("publish");
  const noApproved = counts.approved === 0;
  const rightsBlocked = blockingAssets(items);
  const blocked = !allowed || noApproved || rightsBlocked.length > 0 || !rightsConfirmed || missing || badDates;
  const ready = !noApproved && rightsBlocked.length === 0;

  const details = () => ({
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    venueId: form.venueId || null,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    code: form.code.trim(),
  });

  // Saves the details into the draft; the live guide is unchanged until Publish.
  const saveDetails = async () => {
    if (busy || !can("edit") || !form.title.trim() || badDates) return;
    setBusy(true);
    try {
      await updateExhibition(details());
      setSaved(true);
    } catch { /* error banner */ } finally {
      setBusy(false);
    }
  };

  const addVenue = async () => {
    if (!newVenue?.name.trim() || !newVenue.city.trim()) return;
    try {
      const name = newVenue.name.trim();
      // The server picks the code from the name (SPEC §10.1); the mock needs one that is not taken.
      const code = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const venue = await api.createVenue({ name, city: newVenue.city.trim(), code });
      setVenues((list) => [...list, venue]);
      setForm({ ...form, venueId: venue.id });
      setSaved(false);
      setNewVenue(null);
    } catch (e) { reportError(e); }
  };

  const publish = async () => {
    setAttempted(true);
    if (blocked || busy) return;
    setBusy(true);
    try {
      await updateExhibition(details());
      await publishExhibition();
      navigate("/materials/published");
    } catch { /* error banner */ } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stepper current={4} />
      <PageHead
        eyebrow={<>Publishing <span aria-hidden>/</span> Final settings</>}
        title="Prepare publication"
        lede="Set the visitor access details and confirm the content that will go live."
      >
        <div className="page-head__badge">
          {ready ? <Badge tone="green" className="badge--wide">Ready to publish</Badge> : <Badge tone="amber" className="badge--wide">{noApproved ? "No approved content" : rightsBlocked.length === 1 ? "1 image needs rights" : `${rightsBlocked.length} images need rights`}</Badge>}
        </div>
      </PageHead>
      <hr className="rule" />

      <div className="split split--publish">
        <section>
          <h2 className="h2 section__title">Publication details</h2>
          <label className="field field--stack"><span className="field__label">Publication title</span><input className="input input--tall" value={form.title} onChange={set("title")} /></label>
          <label className="field field--stack"><span className="field__label">Subtitle (optional)</span><input className="input input--tall" value={form.subtitle} onChange={set("subtitle")} /></label>
          <div className="field field--stack">
            <label className="field__label" htmlFor="venue-select">Museum / venue</label>
            <select id="venue-select" className="input input--tall" value={form.venueId} onChange={set("venueId")}>
              <option value="">Choose a venue…</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.city}</option>)}
            </select>
            {newVenue ? (
              <form className="inline-pick" style={{ marginTop: 8, marginBottom: 0 }} onSubmit={(e) => { e.preventDefault(); addVenue(); }}>
                <input className="input" aria-label="New venue name" autoFocus placeholder="Venue name" value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} />
                <input className="input" aria-label="New venue city" placeholder="City" value={newVenue.city} onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })} />
                <button type="submit" className="btn btn--secondary" aria-disabled={!newVenue.name.trim() || !newVenue.city.trim()}>Add venue</button>
                <button type="button" className="link-btn" onClick={() => setNewVenue(null)}>Cancel</button>
              </form>
            ) : (
              <button type="button" className="link-btn" style={{ marginTop: 8 }} onClick={() => setNewVenue({ name: "", city: "" })}>+ Add venue</button>
            )}
          </div>
          <div className="field field--stack">
            <span className="field__label">Exhibition period</span>
            <div className="date-range">
              <input className="input input--tall" type="date" aria-label="Start date" value={form.startDate} onChange={set("startDate")} />
              <span aria-hidden>—</span>
              <input className="input input--tall" type="date" aria-label="End date" value={form.endDate} onChange={set("endDate")} />
            </div>
          </div>
          <label className="field field--stack">
            <span className="field__label">Visitor URL</span>
            <span className="input-prefix">
              <span className="input-prefix__text">{VISITOR_HOST}</span>
              <input className="input input--tall" value={form.code} onChange={set("code")} />
            </span>
          </label>
        </section>

        <section>
          <h2 className="h2 section__title">Visitor access</h2>
          <div className="info-card">
            <p className="strong">QR code and direct link</p>
            <p className="caption-sm">Anyone with the exhibition link can view the guide. Login is required only to save personal content.</p>
          </div>
          <div className="info-card info-card--short">
            <p className="strong">Visitor data &amp; privacy</p>
            <p className="caption-sm">Visitors' journals and saved items are private to each account.</p>
          </div>
        </section>
      </div>

      <section className="rights">
        <h2 className="h3">Content rights confirmation</h2>
        <label className={`checkbox${attempted && !rightsConfirmed ? " has-error" : ""}`}>
          <input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} />
          <span>I confirm that the museum has permission to publish the submitted text and media for this exhibition.</span>
        </label>
        <ul className="blockers">
          {!allowed && <li className="field-error">{NO_PERMISSION.publish}</li>}
          {noApproved && <li className="field-error">No content is approved yet. Only approved items are published.</li>}
          {rightsBlocked.map(({ item, asset, issue }) => (
            <li key={asset.id} className="field-error">
              {asset.caption} ({item.title}): {issue}. Add the rights details or mark it "Don't publish this image" in <Link to="/materials/review">Review</Link>.
            </li>
          ))}
          {counts.needReview + counts.rejected > 0 && (
            <li className="caption-sm">{counts.needReview} items in review and {counts.rejected} rejected items will not be included.</li>
          )}
        </ul>
        {attempted && !rightsConfirmed && <p className="field-error" role="alert">Confirm content rights before publishing.</p>}
        {attempted && missing && <p className="field-error" role="alert">Fill in title, venue, period and visitor URL.</p>}
        {badDates && <p className="field-error" role="alert">End date must be on or after the start date.</p>}
      </section>

      <div className="bottom-actions">
        <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials/preview")}>Back to preview</button>
        {can("edit") && <button type="button" className="btn btn--secondary btn--wide" aria-disabled={busy} onClick={saveDetails}>Save details</button>}
        {saved && <span className="caption-sm" role="status">Details saved</span>}
        <button type="button" className="btn btn--primary btn--xwide" aria-disabled={blocked || busy} onClick={publish}>
          {busy ? "Publishing…" : "Publish exhibition"}
        </button>
      </div>
    </>
  );
}
