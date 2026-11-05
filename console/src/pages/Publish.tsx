import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { VISITOR_HOST } from "../format";
import { blockingAssets } from "../rules";
import { useWorkspace } from "../store";
import { Badge, NoExhibition, PageHead, Stepper } from "../ui";

export default function Publish() {
  const { exhibition, counts, items, updateExhibition, publishExhibition, createExhibition } = useWorkspace();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({
    title: exhibition?.title ?? "",
    subtitle: exhibition?.subtitle ?? "",
    venueName: exhibition?.venueName ?? "",
    startDate: exhibition?.startDate ?? "",
    endDate: exhibition?.endDate ?? "",
    code: exhibition?.code ?? "",
  }));
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!exhibition) return <NoExhibition title="Prepare publication" onCreate={createExhibition} />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const missing = !form.title.trim() || !form.venueName.trim() || !form.startDate || !form.endDate || !form.code.trim();
  const badDates = !!form.startDate && !!form.endDate && form.endDate < form.startDate;
  // Handoff 4.6 / 12: publish is blocked until metadata, approval and rights checks are complete.
  const noApproved = counts.approved === 0;
  const rightsBlocked = blockingAssets(items);
  const blocked = noApproved || rightsBlocked.length > 0 || !rightsConfirmed || missing || badDates;
  const ready = !noApproved && rightsBlocked.length === 0;

  const publish = async () => {
    setAttempted(true);
    if (blocked || busy) return;
    setBusy(true);
    try {
      await updateExhibition({
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        venueName: form.venueName.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        code: form.code.trim(),
      });
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
          <label className="field field--stack"><span className="field__label">Museum / venue</span><input className="input input--tall" value={form.venueName} onChange={set("venueName")} /></label>
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
          {noApproved && <li className="field-error">No content is approved yet. Only approved items are published.</li>}
          {rightsBlocked.map(({ item, asset, issue }) => (
            <li key={asset.id} className="field-error">
              {asset.name} ({item.title}): {issue}. Confirm its rights, or take the item out of the guide, in <Link to="/materials/review">Review</Link>.
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
        <button type="button" className="btn btn--primary btn--xwide" aria-disabled={blocked || busy} onClick={publish}>
          {busy ? "Publishing…" : "Publish exhibition"}
        </button>
      </div>
    </>
  );
}
