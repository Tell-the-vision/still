import { useNavigate } from "react-router-dom";
import type { ContentItem } from "../api";
import { rightsIssue } from "../rules";
import { useWorkspace } from "../store";
import { Arrow, Badge, EmptyState, NoExhibition, PageHead, StatusText, Stepper } from "../ui";

const shown = (i: ContentItem | undefined): i is ContentItem => !!i && !i.removed && i.reviewStatus === "APPROVED";

export default function Preview() {
  const { exhibition, counts, items, guide, checks, createExhibition } = useWorkspace();
  const navigate = useNavigate();

  if (!exhibition) return <NoExhibition title="Preview digital guide" onCreate={createExhibition} />;

  // Handoff 4.5: render the saved guide draft exactly as visitors would get it —
  // visible sections in order, each with its approved content, images only when their rights are clear.
  const byId = new Map(items.map((i) => [i.id, i]));
  const sections = guide.sections
    .filter((s) => s.visible)
    .map((s) => ({ ...s, content: s.itemIds.map((id) => byId.get(id)).filter(shown) }));

  // What the draft has but visitors will not see, so nothing disappears silently.
  // The same item can sit in two sections, so lines are de-duplicated.
  const leftOut = [...new Set([
    ...guide.sections.filter((s) => !s.visible).map((s) => `Section "${s.title}" is hidden`),
    ...guide.sections.flatMap((s) =>
      s.itemIds
        .map((id) => byId.get(id))
        .filter((i): i is ContentItem => !!i && !shown(i))
        .map((i) => `"${i.title}" in ${s.title} is ${i.removed ? "deleted" : i.reviewStatus === "REJECTED" ? "rejected" : "not approved yet"}`),
    ),
    ...sections.flatMap((s) =>
      s.content.flatMap((i) =>
        i.assets.filter((a) => a.excluded || rightsIssue(a)).map((a) => `Image "${a.caption}" (${i.title}): ${a.excluded ? "marked not to publish" : rightsIssue(a)}`),
      ),
    ),
  ])];

  return (
    <>
      <Stepper current={3} />
      <PageHead
        eyebrow={<>Visitor experience <span aria-hidden>/</span> Preview</>}
        title="Preview digital guide"
        lede="The saved guide draft as a visitor will see it on a 390 × 844 phone screen: visible sections, approved content only."
        actions={
          <>
            <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials/review")}>Edit content</button>
            <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/guide")}>Edit guide</button>
          </>
        }
      >
        <div className="page-head__badge"><Badge tone={counts.approved ? "green" : "gray"} className="badge--wide">{counts.approved} approved items</Badge></div>
      </PageHead>
      <hr className="rule" />

      <div className="split split--preview">
        <div className="phone phone--scroll" aria-label="Visitor mobile preview">
          <p className="phone__wordmark">STILL.</p>
          <p className="phone__eyebrow">Exhibition guide</p>
          <h2 className="phone__title">{exhibition.title}</h2>
          {exhibition.subtitle && <p className="phone__sub">{exhibition.subtitle}</p>}

          {sections.length === 0 && <p className="phone__body phone__empty">No visible guide sections yet. Add sections and approved content in Digital guide.</p>}
          {sections.map((s) => (
            <section key={s.id} className="phone__section">
              <h3 className="phone__h3">{s.title}</h3>
              {s.intro && <p className="phone__body">{s.intro}</p>}
              {s.content.map((i) => {
                const images = i.assets.filter((a) => !a.excluded && !rightsIssue(a));
                return (
                  <div key={i.id} className="phone__block">
                    {images.map((a) => (
                      <figure key={a.id} className="phone__figure">
                        <div className="phone__image">Image</div>
                        <figcaption className="phone__credit">{a.caption}{a.copyrightHolder && ` · © ${a.copyrightHolder}`}</figcaption>
                      </figure>
                    ))}
                    <p className={`phone__body${i.contentType === "Guide sentence" ? " phone__quote" : ""}`}>{i.text}</p>
                  </div>
                );
              })}
              {s.content.length === 0 && <p className="phone__body phone__empty">No approved content in this section yet.</p>}
            </section>
          ))}
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
          <div className="left-out">
            <p className="strong">Not shown to visitors · {leftOut.length}</p>
            {leftOut.length === 0 ? (
              <p className="caption-sm">Everything in the guide draft is visible.</p>
            ) : (
              <ul>{leftOut.map((t) => <li key={t} className="caption-sm">{t}</li>)}</ul>
            )}
          </div>
          <p className="caption-sm">Preview uses the saved guide draft and approved content only. Link and media checks run on the server once it exists.</p>
          <div className="checks__cta">
            <button type="button" className="btn btn--primary btn--xwide" onClick={() => navigate("/materials/publish")}>Continue to publication</button>
          </div>
        </section>
      </div>
    </>
  );
}
