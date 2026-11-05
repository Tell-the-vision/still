import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GuideSection, ThemeCard } from "../api";
import { useWorkspace } from "../store";
import { Badge, EmptyState, NoExhibition, PageHead } from "../ui";

export default function Guide() {
  const { exhibition, guide, counts, items, approvedItems, saveGuide, publishGuide, createExhibition, can } = useWorkspace();
  const editable = can("edit");
  const navigate = useNavigate();

  // Local working copy; saved to the server on "Publish changes".
  const [sections, setSections] = useState<GuideSection[]>(guide.sections);
  const [themes, setThemes] = useState<ThemeCard[]>(guide.themes);
  const [localDirty, setLocalDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);

  useEffect(() => {
    setSections(guide.sections);
    setThemes(guide.themes);
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
    edit(() => setSections((s) => [...s, { id, title: "Untitled section", summary: "Draft · 0 items", visible: false, intro: "", itemIds: [] }]));
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
  const setSectionItems = (id: string, itemIds: string[]) =>
    patchSection(id, { itemIds, summary: `Draft · ${itemIds.length} ${itemIds.length === 1 ? "item" : "items"}` });
  const moveItem = (sectionId: string, ids: string[], from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setSectionItems(sectionId, next);
  };

  const patchTheme = (id: string, patch: Partial<ThemeCard>) => edit(() => setThemes((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t))));
  const removeTheme = (id: string) => { edit(() => setThemes((l) => l.filter((t) => t.id !== id))); setEditingThemeId(null); };
  const addTheme = () => {
    const id = `theme-${Date.now()}`;
    edit(() => setThemes((l) => [...l, { id, name: "", description: "" }]));
    setEditingThemeId(id);
  };
  // Leaving a card with no name removes it, so empty cards never reach the server.
  const finishTheme = (id: string) => {
    const t = themes.find((x) => x.id === id);
    if (t && !t.name.trim()) removeTheme(id);
    else { patchTheme(id, { name: t?.name.trim() ?? "", description: t?.description.trim() ?? "" }); setEditingThemeId(null); }
  };

  const moveTheme = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    edit(() =>
      setThemes((list) => {
        const from = list.findIndex((t) => t.id === dragId);
        const to = list.findIndex((t) => t.id === targetId);
        const next = [...list];
        next.splice(to, 0, next.splice(from, 1)[0]);
        return next;
      }),
    );
  };

  // Saves the working copy as the guide draft (live guide unchanged until Publish changes).
  const saveDraft = async () => {
    setBusy(true);
    try { await saveGuide({ sections, themes }); } catch { /* error banner */ } finally { setBusy(false); }
  };

  const publish = async () => {
    setBusy(true);
    try {
      if (localDirty) await saveGuide({ sections, themes });
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
        actions={
          <>
            {editable && (
              <button type="button" className="btn btn--secondary btn--wide" aria-disabled={!localDirty || busy} onClick={() => localDirty && !busy && saveDraft()}>
                Save draft
              </button>
            )}
            <button type="button" className="btn btn--secondary btn--wide" onClick={() => (localDirty && editable ? saveDraft().then(() => navigate("/materials/preview")) : navigate("/materials/preview"))}>
              Preview guide
            </button>
            {can("publish") && (
              <button type="button" className="btn btn--primary btn--xwide" aria-disabled={!unpublished || busy} onClick={() => unpublished && !busy && publish()}>
                {busy ? "Publishing…" : "Publish changes"}
              </button>
            )}
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
                  draggable={editable}
                  onDragStart={() => setDragSectionId(s.id)}
                  onDragOver={(e) => { e.preventDefault(); if (dragSectionId && dragSectionId !== s.id) moveSection(dragSectionId, i); }}
                  onDragEnd={() => setDragSectionId(null)}
                >
                  <button type="button" className={`item${s.id === selected?.id ? " is-selected" : ""}`} onClick={() => setSelectedId(s.id)}>
                    <span className="item__no">{String(i + 1).padStart(2, "0")}</span>
                    <span className="item__body">
                      <span className="item__title">{s.title}</span>
                      <span className="item__meta">{s.summary}</span>
                      <span className={`item__status ${s.visible ? "tone-green" : "tone-gray"}`}>{s.visible ? "Visible" : "Hidden"}</span>
                    </span>
                  </button>
                  {editable && (
                    <span className="reorder">
                      <button type="button" className="reorder__btn" aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => moveSection(s.id, i - 1)}>↑</button>
                      <button type="button" className="reorder__btn" aria-label={`Move ${s.title} down`} disabled={i === sections.length - 1} onClick={() => moveSection(s.id, i + 1)}>↓</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <div className="panel__foot">
              <button type="button" className="btn btn--secondary btn--wide" onClick={addSection}>+ Add guide section</button>
            </div>
          )}
        </section>

        {selected ? (
          // Read-only roles see the section but every control inside is disabled.
          <fieldset className="panel panel--padded plain-fieldset--panel" disabled={!editable}>
            <div className="editor__title editor__title--top">
              <p className="eyebrow">Section {selectedNo} <span aria-hidden>/</span> {selected.title}</p>
              {selected.visible ? <Badge tone="green">Visible</Badge> : <Badge>Hidden</Badge>}
            </div>
            <label className="field field--first">
              <span className="field__label">Section title</span>
              <input className="input input--title" value={selected.title} onChange={(e) => patchSection(selected.id, { title: e.target.value })} />
            </label>

            <label className="field field--gap">
              <span className="field__label">Section introduction</span>
              <textarea className="input input--lg" rows={3} value={selected.intro} onChange={(e) => patchSection(selected.id, { intro: e.target.value })} />
            </label>

            <label className="toggle">
              <input type="checkbox" checked={selected.visible} onChange={(e) => patchSection(selected.id, { visible: e.target.checked })} />
              <span>Visible to visitors</span>
            </label>

            <p className="field__label">Content in this section · {selected.itemIds.length}</p>
            <ul className="section-items">
              {selected.itemIds.map((id, idx) => {
                const item = items.find((i) => i.id === id);
                const live = item && !item.removed && item.reviewStatus === "APPROVED";
                return (
                  <li key={id}>
                    <span className="section-items__text">
                      <span className="strong">{item?.title ?? "Deleted item"}</span>
                      <span className="caption-sm">{item ? item.summary : "No longer in the content list"}</span>
                      {!live && <span className="caption-sm tone-amber">Not approved — hidden from visitors until it is approved again</span>}
                    </span>
                    <span className="reorder">
                      <button type="button" className="reorder__btn" aria-label="Move up" disabled={idx === 0} onClick={() => moveItem(selected.id, selected.itemIds, idx, idx - 1)}>↑</button>
                      <button type="button" className="reorder__btn" aria-label="Move down" disabled={idx === selected.itemIds.length - 1} onClick={() => moveItem(selected.id, selected.itemIds, idx, idx + 1)}>↓</button>
                      <button type="button" className="link-btn" onClick={() => setSectionItems(selected.id, selected.itemIds.filter((x) => x !== id))}>Remove</button>
                    </span>
                  </li>
                );
              })}
              {selected.itemIds.length === 0 && <li className="caption-sm section-items__empty">No content yet. Add approved items below.</li>}
            </ul>
            {(() => {
              const available = approvedItems.filter((i) => !selected.itemIds.includes(i.id));
              return (
                <div className="inline-pick">
                  <select className="input" aria-label="Approved content to add" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">{available.length ? "Choose approved content…" : "No other approved content"}</option>
                    {available.map((i) => <option key={i.id} value={i.id}>{String(i.order).padStart(2, "0")} {i.title} · {i.summary}</option>)}
                  </select>
                  <button type="button" className="btn btn--secondary" aria-disabled={!pick} onClick={() => { if (!pick) return; setSectionItems(selected.id, [...selected.itemIds, pick]); setPick(""); }}>Add to section</button>
                </div>
              );
            })()}

            <p className="field__label">Theme cards · Drag to reorder</p>
            <ul className="theme-list">
              {themes.map((t) =>
                editingThemeId === t.id ? (
                  <li key={t.id} className="theme-edit">
                    <input
                      className="input"
                      aria-label="Theme name"
                      placeholder="Theme name"
                      autoFocus
                      value={t.name}
                      onChange={(e) => patchTheme(t.id, { name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && finishTheme(t.id)}
                    />
                    <input
                      className="input"
                      aria-label="Theme description"
                      placeholder="Short description (e.g. 끝과 시작, 유한한 생명)"
                      value={t.description}
                      onChange={(e) => patchTheme(t.id, { description: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && finishTheme(t.id)}
                    />
                    <span className="theme-edit__actions">
                      <button type="button" className="link-btn link-btn--danger" onClick={() => removeTheme(t.id)}>Delete</button>
                      <button type="button" className="link-btn link-btn--strong" onClick={() => finishTheme(t.id)}>Done</button>
                    </span>
                  </li>
                ) : (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragOver={(e) => { e.preventDefault(); moveTheme(t.id); }}
                    onDragEnd={() => setDragId(null)}
                    className={dragId === t.id ? "is-dragging" : ""}
                  >
                    <span className="grip" aria-hidden>⋮</span>
                    <span className="strong">{t.name || "Untitled theme"}</span>
                    <span className="caption-sm">{t.description}</span>
                    <button type="button" className="link-btn" onClick={() => setEditingThemeId(t.id)}>Edit</button>
                  </li>
                ),
              )}
            </ul>
            {themes.length === 0 && <p className="caption-sm theme-empty">No theme cards yet.</p>}
            <button type="button" className="btn btn--secondary theme-add" onClick={addTheme}>+ Add theme card</button>
            <hr className="rule rule--light" />
            <p className="caption-sm">Only approved content is available to add to the guide. Draft edits do not affect the live version.</p>
          </fieldset>
        ) : (
          <EmptyState title="No section selected" body="Add a guide section to start building the visitor guide." />
        )}
      </div>
    </>
  );
}
