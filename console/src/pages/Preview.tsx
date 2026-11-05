import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ContentItem, StillDoc, StillNode } from "../api";
import { VisitorPreview } from "../editor/VisitorPreview";
import { readableCheckDetail, rightsIssue } from "../rules";
import { useWorkspace } from "../store";
import { Arrow, Badge, EmptyState, NoExhibition, PageHead, StatusText, Stepper } from "../ui";

const shown = (i: ContentItem | undefined): i is ContentItem => !!i && i.reviewStatus === "APPROVED";

// The item's document as the visitor renderer draws it. Sample (mock) items have no document: their images
// and text stand in. Images whose rights are not clear are left out, as on the live guide; "Not shown" lists them.
function visitorDoc(i: ContentItem): StillDoc {
  const doc: StillDoc = i.doc ?? {
    type: "doc",
    content: [
      ...i.assets.map((a): StillNode => ({ type: "stillImage", attrs: { imageId: a.id, display: "INLINE", caption: a.credit } })),
      ...i.text.split(/\n\s*\n/).map((t): StillNode => ({ type: "paragraph", content: t ? [{ type: "text", text: t }] : [] })),
    ],
  };
  const unclear = new Set(i.assets.filter((a) => rightsIssue(a)).map((a) => a.id));
  return { ...doc, content: doc.content.filter((n) => !(n.type === "stillImage" && unclear.has(n.attrs?.imageId ?? ""))) };
}

export default function Preview() {
  const { exhibition, counts, items, guide, checks, imageUrls, refreshChecks, createExhibition } = useWorkspace();
  const navigate = useNavigate();

  // The guide draft may have changed since the checks were read (a saved section, new details).
  useEffect(() => {
    if (exhibition) void refreshChecks();
    // Once per opened exhibition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exhibition?.id]);

  if (!exhibition) return <NoExhibition title="Preview digital guide" onCreate={createExhibition} />;

  // Handoff 4.5: render the saved guide draft exactly as visitors would get it —
  // visible sections in order, each with its approved content, images only when their rights are clear.
  const byId = new Map(items.map((i) => [i.id, i]));
  const sections = guide.sections
    .filter((s) => s.visible)
    .map((s) => ({ ...s, content: s.contentIds.map((id) => byId.get(id)).filter(shown) }));

  // What the draft has but visitors will not see, so nothing disappears silently.
  // The same item can sit in two sections, so lines are de-duplicated.
  const leftOut = [...new Set([
    ...guide.sections.filter((s) => !s.visible).map((s) => `Section "${s.title}" is hidden`),
    ...guide.sections.flatMap((s) =>
      s.contentIds
        .map((id) => byId.get(id))
        .filter((i): i is ContentItem => !!i && !shown(i))
        .map((i) => `"${i.title}" in ${s.title} is ${i.reviewStatus === "REJECTED" ? "rejected" : "not approved yet"}`),
    ),
    ...sections.flatMap((s) =>
      s.content.flatMap((i) =>
        i.assets.filter((a) => rightsIssue(a)).map((a) => `Image "${a.name}" (${i.title}): ${rightsIssue(a)}`),
      ),
    ),
  ])];

  return (
    <>
      <Stepper current={3} />
      <PageHead
        eyebrow={<>Visitor experience <span aria-hidden>/</span> Preview</>}
        title="Preview digital guide"
        lede="The saved guide draft as visitors will see it on their phone. Approved content only."
        actionsBottom
        actions={
          <>
            <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/guide")}>Edit guide</button>
            <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials/review")}>Edit content</button>
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
              {s.content.map((i) => (
                <div key={i.id} className="phone__block">
                  <VisitorPreview doc={visitorDoc(i)} imageUrls={imageUrls} embedded />
                </div>
              ))}
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
                    <p className="caption-sm">{readableCheckDetail(c.detail, items)}</p>
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
