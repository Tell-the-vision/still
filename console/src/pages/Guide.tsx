import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GuideSection, SectionKind } from "../api";
import { useWorkspace } from "../store";
import { Badge, EmptyState, NoExhibition, PageHead } from "../ui";

// SPEC §10.9: a section is {id, kind, title, visible, contentIds}. Its opening text is the first THEME or
// INTRODUCTION content item in it; sections have no intro, summary or theme cards of their own (issue #63).
const KINDS: { value: SectionKind; label: string }[] = [
  { value: "INTRODUCTION", label: "Introduction" },
  { value: "ARTIST", label: "Artist" },
  { value: "THEMES", label: "Themes" },
  { value: "ARTWORK_HIGHLIGHTS", label: "Artwork highlights" },
  { value: "GALLERY_GUIDE", label: "Gallery guide" },
  { value: "CLOSING", label: "Closing" },
  { value: "CUSTOM", label: "Custom" },
];
const kindLabel = (k: SectionKind) => KINDS.find((x) => x.value === k)?.label ?? k;

export default function Guide() {
  const { exhibition, guide, counts, items, approvedItems, saveGuide, publishGuide, createExhibition } = useWorkspace();
  const navigate = useNavigate();

  // Local working copy; saved to the server on "Publish changes".
  const [sections, setSections] = useState<GuideSection[]>(guide.sections);
  const [localDirty, setLocalDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSections(guide.sections);
    setLocalDirty(false);
  }, [guide]);

  if (!exhibition) return <NoExhibition title="Digital guide" onCreate={createExhibition} />;

  const selected = sections.find((s) => s.id === selectedId) ?? sections[0] ?? null;
  const selectedNo = selected ? String(sections.indexOf(selected) + 1).padStart(2, "0") : "";
  const unpublished = localDirty || guide.hasUnpublishedChanges;

  const edit = (fn: () => void) => { fn(); setLocalDirty(true); };
  const patchSection = (id: string, patch: Partial<GuideSection>) => edit(() => setSections((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s))));

  const addSection = () => {
    const id = `new-${Date.now()}`;
    edit(() => setSections((s) => [...s, { id, kind: "CUSTOM", title: "Untitled section", visible: false, contentIds: [] }]));
    setSelectedId(id);
  };

  // Handoff 4.4: sections can be reordered; content inside a section references approved items only.
  const moveSection = (id: string, to: number) =>
    edit(() => setSections((list) => {
      const from = list.findIndex((s) => s.id === id);
      if (from < 0 || to < 0 || to >= list.length || from === to) return list;
      const next = [...list];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    }));
  const setSectionItems = (id: string, contentIds: string[]) => patchSection(id, { contentIds });
  const moveItem = (sectionId: string, ids: string[], from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setSectionItems(sectionId, next);
  };

  // Saves the working copy as the guide draft (live guide unchanged until Publish changes).
  const saveDraft = async () => {
    setBusy(true);
    try { await saveGuide(sections); } catch { /* error banner */ } finally { setBusy(false); }
  };

  const publish = async () => {
    setBusy(true);
    try {
      if (localDirty) await saveGuide(sections);
      await publishGuide();
    } catch { /* error banner */ } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Visitor experience"
        title="Digital guide"
        lede="Build and manage the content visitors see on their phones. Changes stay in draft until you publish them."
        actionsBottom
        actions={
          <>
            <button type="button" className="btn btn--secondary btn--wide" aria-disabled={!localDirty || busy} onClick={() => localDirty && !busy && saveDraft()}>
              Save draft
            </button>
            <button type="button" className="btn btn--secondary btn--wide" onClick={() => (localDirty ? saveDraft().then(() => navigate("/materials/preview")) : navigate("/materials/preview"))}>
              Preview guide
            </button>
            <button type="button" className="btn btn--primary btn--xwide" aria-disabled={!unpublished || busy} onClick={() => unpublished && !busy && publish()}>
              {busy ? "Publishing…" : "Publish changes"}
            </button>
          </>
        }
      >
        <div className="page-head__badge">
          {unpublished ? <Badge tone="amber" className="badge--wide">Draft · Not published</Badge> : <Badge tone="green" className="badge--wide">Up to date</Badge>}
        </div>
      </PageHead>
      <hr className="rule" />

      <div className="section__head section__head--guide">
        <div>
          <h2 className="h2">Guide structure</h2>
          <p className="caption-sm">Manage the order and visibility of visitor-facing sections.</p>
        </div>
        <Badge tone={counts.approved ? "green" : "gray"} className="badge--xwide">{counts.approved} approved content items</Badge>
      </div>

      <div className="split split--guide">
        <section className="panel">
          <div className="panel__head">
            <span className="eyebrow">Guide sections</span>
            <span className="eyebrow">{sections.length} sections</span>
          </div>
          {sections.length === 0 ? (
            <p className="empty">No sections yet.</p>
          ) : (
            <ul className="item-list">
              {sections.map((s, i) => (
                <li
                  key={s.id}
                  className={`section-row${dragSectionId === s.id ? " is-dragging" : ""}`}
                  draggable
                  onDragStart={() => setDragSectionId(s.id)}
                  onDragOver={(e) => { e.preventDefault(); if (dragSectionId && dragSectionId !== s.id) moveSection(dragSectionId, i); }}
                  onDragEnd={() => setDragSectionId(null)}
                >
                  <button type="button" className={`item${s.id === selected?.id ? " is-selected" : ""}`} onClick={() => setSelectedId(s.id)}>
                    <span className="item__no">{String(i + 1).padStart(2, "0")}</span>
                    <span className="item__body">
                      <span className="item__title">{s.title}</span>
                      <span className="item__meta">{kindLabel(s.kind)} · {s.contentIds.length} {s.contentIds.length === 1 ? "item" : "items"}</span>
                      <span className={`item__status ${s.visible ? "tone-green" : "tone-gray"}`}>{s.visible ? "Visible" : "Hidden"}</span>
                    </span>
                  </button>
                  <span className="reorder">
                    <button type="button" className="reorder__btn" aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => moveSection(s.id, i - 1)}>↑</button>
                    <button type="button" className="reorder__btn" aria-label={`Move ${s.title} down`} disabled={i === sections.length - 1} onClick={() => moveSection(s.id, i + 1)}>↓</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="panel__foot">
            <button type="button" className="btn btn--secondary btn--wide" onClick={addSection}>+ Add guide section</button>
          </div>
        </section>

        {selected ? (
          <div className="panel panel--padded plain-fieldset--panel">
            <div className="editor__title editor__title--top">
              <p className="eyebrow">Section {selectedNo} <span aria-hidden>/</span> {selected.title}</p>
              {selected.visible ? <Badge tone="green">Visible</Badge> : <Badge>Hidden</Badge>}
            </div>
            <label className="field field--first">
              <span className="field__label">Section title</span>
              <input className="input input--title" value={selected.title} onChange={(e) => patchSection(selected.id, { title: e.target.value })} />
            </label>

            <label className="field field--gap">
              <span className="field__label">Section type</span>
              <select className="input" value={selected.kind} onChange={(e) => patchSection(selected.id, { kind: e.target.value as SectionKind })}>
                {KINDS.map((k) => (
                  // Only one Introduction: it becomes the exhibition description (SPEC §10.9).
                  <option key={k.value} value={k.value} disabled={k.value === "INTRODUCTION" && sections.some((x) => x.kind === "INTRODUCTION" && x.id !== selected.id)}>{k.label}</option>
                ))}
              </select>
            </label>

            <label className="toggle">
              <input type="checkbox" checked={selected.visible} onChange={(e) => patchSection(selected.id, { visible: e.target.checked })} />
              <span>Visible to visitors</span>
            </label>

            <p className="field__label">Content in this section · {selected.contentIds.length}</p>
            <ul className="section-items">
              {selected.contentIds.map((id, idx) => {
                const item = items.find((i) => i.id === id);
                const live = item && item.reviewStatus === "APPROVED";
                return (
                  <li key={id}>
                    <span className="section-items__text">
                      <span className="strong">{item?.title ?? "Deleted item"}</span>
                      <span className="caption-sm">{item ? item.summary : "No longer in the content list"}</span>
                      {!live && <span className="caption-sm tone-amber">Not approved — hidden from visitors until it is approved again</span>}
                    </span>
                    <span className="reorder">
                      <button type="button" className="reorder__btn" aria-label="Move up" disabled={idx === 0} onClick={() => moveItem(selected.id, selected.contentIds, idx, idx - 1)}>↑</button>
                      <button type="button" className="reorder__btn" aria-label="Move down" disabled={idx === selected.contentIds.length - 1} onClick={() => moveItem(selected.id, selected.contentIds, idx, idx + 1)}>↓</button>
                      <button type="button" className="link-btn" onClick={() => setSectionItems(selected.id, selected.contentIds.filter((x) => x !== id))}>Remove</button>
                    </span>
                  </li>
                );
              })}
              {selected.contentIds.length === 0 && <li className="caption-sm section-items__empty">No content yet. Add approved items below; put a theme or introduction item first to open the section.</li>}
            </ul>
            {(() => {
              // One item appears once in the whole guide (SPEC §10.9).
              const used = new Set(sections.flatMap((x) => x.contentIds));
              const available = approvedItems.filter((i) => !used.has(i.id));
              return (
                <div className="inline-pick">
                  <select className="input" aria-label="Approved content to add" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">{available.length ? "Choose approved content…" : "No other approved content"}</option>
                    {available.map((i) => <option key={i.id} value={i.id}>{String(i.order).padStart(2, "0")} {i.title} · {i.summary}</option>)}
                  </select>
                  <button type="button" className="btn btn--secondary" aria-disabled={!pick} onClick={() => { if (!pick) return; setSectionItems(selected.id, [...selected.contentIds, pick]); setPick(""); }}>Add to section</button>
                </div>
              );
            })()}

            <hr className="rule rule--light" />
            <p className="caption-sm">Only approved content is available to add to the guide. Draft edits do not affect the live version.</p>
          </div>
        ) : (
          <EmptyState title="No section selected" body="Add a guide section to start building the visitor guide." />
        )}
      </div>
    </>
  );
}
