import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { qrUrl } from "../api/qr";
import { visitorUrl } from "../format";
import { useWorkspace } from "../store";
import { Arrow, Badge, EmptyState, NoExhibition, Stepper } from "../ui";


export default function Published() {
  const { exhibition, createExhibition } = useWorkspace();
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  // The visitor guide is served from the same origin as this console.
  const liveUrl = exhibition ? `${window.location.origin}/e/${encodeURIComponent(exhibition.code)}` : "";

  if (!exhibition) return <NoExhibition title="Publication" onCreate={createExhibition} />;
  if (exhibition.status !== "PUBLISHED") {
    return (
      <>
        <Stepper current={4} />
        <EmptyState
          title="Not published yet"
          body="Finish the publication settings to make the guide live."
          action={<button type="button" className="btn btn--primary btn--xwide" onClick={() => navigate("/materials/publish")}>Prepare publication</button>}
        />
      </>
    );
  }

  const url = visitorUrl(exhibition.code);
  // Handoff 4.7: the server draws the QR (SPEC §9.5), so the printed code always encodes its URL.
  const qr = qrUrl(exhibition.code, "png");
  const qrFilename = `${exhibition.code}-qr.png`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
    } catch { /* clipboard blocked */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <Stepper current={4} />
      <div className="published-head">
        <Badge tone="green" className="badge--wide">Published</Badge>
        <p className="eyebrow">Publication complete</p>
        <h1 className="h1 h1--xl">Your guide is live.</h1>
        <p className="lede">Visitors can now open the exhibition guide using the QR code or direct link.</p>
      </div>
      <hr className="rule" />

      <div className="share">
        <div className="share__url">
          <p className="eyebrow">Visitor guide URL</p>
          <p className="share__link">{liveUrl}</p>
          <button type="button" className="btn btn--secondary btn--wide" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
        </div>
        <div className="qr-block" id="qr">
          <img className="qr qr--img" src={qr} width={180} height={180} alt={`QR code for ${url}`} />
          <a className="btn btn--secondary" href={qr} download={qrFilename}>Download QR (PNG)</a>
        </div>
      </div>

      <section className="section">
        <h2 className="h2 section__title">Next steps</h2>
        <ul className="next-list">
          <li>
            <span className="strong">Download QR code</span>
            <span className="caption-sm">Print and place the QR code at the exhibition entrance.</span>
            <a className="open-link" href={qr} download={qrFilename}>Download <Arrow /></a>
          </li>
          <li>
            <span className="strong">View live guide</span>
            <span className="caption-sm">Open the visitor-facing mobile exhibition guide in a new tab.</span>
            <a className="open-link" href={liveUrl} target="_blank" rel="noreferrer">Open <Arrow /></a>
          </li>
          <li>
            <span className="strong">Manage exhibition</span>
            <span className="caption-sm">Return to this workspace to update content or unpublish.</span>
            <Link to="/overview" className="open-link">Open <Arrow /></Link>
          </li>
        </ul>
      </section>

      <button type="button" className="btn btn--secondary btn--xwide" onClick={() => navigate("/overview")}>Back to exhibition workspace</button>
    </>
  );
}
