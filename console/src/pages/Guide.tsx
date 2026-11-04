import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GuideSection, ThemeCard } from "../api";
import { useWorkspace } from "../store";
import { Badge, EmptyState, NoExhibition, PageHead } from "../ui";

export default function Guide() {
  const { exhibition, guide, counts, saveGuide, publishGuide, createExhibition } = useWorkspace();
  const navigate = useNavigate();

  // Local working copy; saved to the server on "Publish changes".
  const [sections, setSections] = useState<GuideSection[]>(guide.sections);
  const [themes, setThemes] = useState<ThemeCard[]>(guide.themes);
  const [localDirty, setLocalDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
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
    edit(() => setSections((s) => [...s, { id, title: "Untitled section", summary: "Draft · 0 blocks", visible: false, intro: "" }]));
    setSelectedId(id);
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
            <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials/preview")}>Preview guide</button>
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
                <li key={s.id}>
                  <button type="button" className={`item${s.id === selected?.id ? " is-selected" : ""}`} onClick={() => setSelectedId(s.id)}>
                    <span className="item__no">{String(i + 1).padStart(2, "0")}</span>
                    <span className="item__body">
                      <span className="item__title">{s.title}</span>
                      <span className="item__meta">{s.summary}</span>
                      <span className={`item__status ${s.visible ? "tone-green" : "tone-gray"}`}>{s.visible ? "Visible" : "Hidden"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="panel__foot">
            <button type="button" className="btn btn--secondary btn--wide" onClick={addSection}>+ Add guide section</button>
          </div>
        </section>

        {selected ? (
          <section className="panel panel--padded">
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
          </section>
        ) : (
          <EmptyState title="No section selected" body="Add a guide section to start building the visitor guide." />
        )}
      </div>
    </>
  );
}
