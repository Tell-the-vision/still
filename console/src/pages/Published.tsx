import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { visitorUrl } from "../format";
import { useWorkspace } from "../store";
import { Arrow, Badge, EmptyState, NoExhibition, Stepper } from "../ui";

const NEXT = [
  { title: "Download QR code", detail: "Print and place the QR code at the exhibition entrance.", to: "#qr" },
  { title: "View live guide", detail: "Open the visitor-facing mobile exhibition guide.", to: "/materials/preview" },
  { title: "Manage exhibition", detail: "Return to this workspace to update content or unpublish.", to: "/overview" },
];

export default function Published() {
  const { exhibition, createExhibition } = useWorkspace();
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

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
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${url}`);
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
          <p className="share__link">{url}</p>
          <button type="button" className="btn btn--secondary btn--wide" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
        </div>
        {/* TODO: render a real QR for https://{url} (server PNG or a QR library) */}
        <div className="qr" id="qr" aria-label="QR code placeholder">QR CODE</div>
      </div>

      <section className="section">
        <h2 className="h2 section__title">Next steps</h2>
        <ul className="next-list">
          {NEXT.map((n) => (
            <li key={n.title}>
              <span className="strong">{n.title}</span>
              <span className="caption-sm">{n.detail}</span>
              <Link to={n.to} className="open-link">Open <Arrow /></Link>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className="btn btn--secondary btn--xwide" onClick={() => navigate("/overview")}>Back to exhibition workspace</button>
    </>
  );
}
