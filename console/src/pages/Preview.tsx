import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../store";
import { Arrow, Badge, EmptyState, NoExhibition, PageHead, StatusText, Stepper } from "../ui";

export default function Preview() {
  const { exhibition, counts, items, checks, createExhibition } = useWorkspace();
  const navigate = useNavigate();

  if (!exhibition) return <NoExhibition title="Preview digital guide" onCreate={createExhibition} />;

  // The phone shows the first approved item as the "About" text.
  const about = items.find((i) => i.pendingCount === 0)?.text;

  return (
    <>
      <Stepper current={3} />
      <PageHead
        eyebrow={<>Visitor experience <span aria-hidden>/</span> Preview</>}
        title="Preview digital guide"
        lede="Check how approved exhibition content will appear on a visitor's mobile screen."
        actions={<button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials/review")}>Edit content</button>}
      >
        <div className="page-head__badge"><Badge tone={counts.approved ? "green" : "gray"} className="badge--wide">{counts.approved} approved items</Badge></div>
      </PageHead>
      <hr className="rule" />

      <div className="split split--preview">
        <div className="phone" aria-label="Visitor mobile preview">
          <p className="phone__wordmark">STILL.</p>
          <p className="phone__eyebrow">Exhibition guide</p>
          <h2 className="phone__title">{exhibition.title}</h2>
          {exhibition.subtitle && <p className="phone__sub">{exhibition.subtitle}</p>}
          <div className="phone__image">Exhibition image <span aria-hidden>/</span> Approved asset</div>
          <h3 className="phone__h3">About the exhibition</h3>
          <p className="phone__body">{about ?? "Approved introduction text will appear here."}</p>
          <hr className="phone__rule" />
          <p className="phone__link">Explore the exhibition <Arrow /></p>
        </div>

        <section className="panel panel--padded checks">
          <h2 className="h2">Pre-publication checks</h2>
          {checks.length === 0 ? (
            <EmptyState title="No checks yet" body="Checks run once content has been extracted." />
          ) : (
            <ul className="check-list">
              {checks.map((c) => (
                <li key={c.id}>
                  <div>
                    <p className="strong">{c.title}</p>
                    <p className="caption-sm">{c.detail}</p>
                  </div>
                  <StatusText tone={c.ok ? "green" : "amber"}>{c.value}</StatusText>
                </li>
              ))}
            </ul>
          )}
          <p className="caption-sm">Preview uses approved content only. Unapproved items remain hidden from visitors.</p>
          <div className="checks__cta">
            <button type="button" className="btn btn--primary btn--xwide" onClick={() => navigate("/materials/publish")}>Continue to publication</button>
          </div>
        </section>
      </div>
    </>
  );
}
