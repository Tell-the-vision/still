import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ContentItem, ContentItemPatch } from "../api";
import { CONTENT_TYPE_OPTIONS, THEME_OPTIONS } from "../constants";
import { useWorkspace } from "../store";
import { Badge, EmptyState, NoExhibition, PageHead } from "../ui";

type Filter = "all" | "review" | "approved";

export default function Review() {
  const { exhibition, items, counts, updateItem, approveItem, createExhibition } = useWorkspace();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<"source" | "attention">("source");
  const [flash, setFlash] = useState<string | null>(null);

  const visible = useMemo(() => {
    let list = items.filter((i) => (filter === "all" ? true : filter === "review" ? i.pendingCount > 0 : i.pendingCount === 0));
    if (sort === "attention") list = [...list].sort((a, b) => b.pendingCount - a.pendingCount);
    return list;
  }, [items, filter, sort]);

  if (!exhibition) return <NoExhibition title="Review extracted content" onCreate={createExhibition} />;

  // Default selection: first item needing review, else the first item.
  const selected = items.find((i) => i.id === selectedId) ?? items.find((i) => i.pendingCount > 0) ?? items[0] ?? null;

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2000);
  };

  const approveAll = async () => {
    // Approves every group that still has pending entries. Swap for a bulk endpoint if the backend adds one.
    const pending = items.filter((i) => i.pendingCount > 0);
    for (const i of pending) await approveItem(i.id).catch(() => {});
    showFlash(pending.length ? `${pending.length} groups approved` : "Nothing left to approve");
  };

  return (
    <>
      <PageHead
        eyebrow={<>Exhibition setup <span aria-hidden>/</span> Step 02</>}
        title="Review extracted content"
        lede="STILL has organised your files into editable content. Review each item before publishing."
      />
      <div className="toolbar">
        <div className="toolbar__summary">
          {items.length ? <Badge tone="green" className="badge--wide">Analysis complete</Badge> : <Badge className="badge--wide">No analysis yet</Badge>}
          <span className="muted">{counts.total} items found · {counts.approved} ready · {counts.needReview} need attention</span>
        </div>
        <div className="toolbar__actions">
          <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials/preview")}>Preview digital guide</button>
          <button type="button" className="btn btn--primary btn--wide" onClick={approveAll} disabled={!items.length}>Approve all ready</button>
        </div>
      </div>
      <hr className="rule rule--tight" />

      {items.length === 0 ? (
        <EmptyState
          title="No extracted content yet"
          body="Upload materials and start analysis. Extracted items will appear here for review."
          action={<button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials")}>Go to upload</button>}
        />
      ) : (
        <>
          <div className="filterbar">
            <div className="chips" role="tablist" aria-label="Filter content">
              {([["all", `All ${counts.total}`], ["review", `Needs review ${counts.needReview}`], ["approved", `Approved ${counts.approved}`]] as const).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} className={`chip chip--btn${filter === key ? " is-active" : ""}`} onClick={() => setFilter(key)}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="sort" onClick={() => setSort((s) => (s === "source" ? "attention" : "source"))}>
              Sort: {sort === "source" ? "Source order" : "Needs attention"} <span aria-hidden>▾</span>
            </button>
          </div>
          {flash && <p className="flash" role="status">{flash}</p>}

          <div className="split split--review">
            <section className="panel">
              <div className="panel__head">
                <span className="eyebrow">Extracted content</span>
                <span className="eyebrow">{counts.total} items</span>
              </div>
              <ul className="item-list">
                {visible.map((i) => (
                  <li key={i.id}>
                    <button type="button" className={`item${i.id === selected?.id ? " is-selected" : ""}`} onClick={() => setSelectedId(i.id)}>
                      <span className="item__no">{String(i.order).padStart(2, "0")}</span>
                      <span className="item__body">
                        <span className="item__title">{i.title}</span>
                        <span className="item__meta">{i.summary}</span>
                        <span className={`item__status ${i.pendingCount ? "tone-amber" : "tone-green"}`}>{i.pendingCount ? "Review" : "Approved"}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {visible.length === 0 && <li className="empty">Nothing in this filter.</li>}
              </ul>
            </section>

            {selected && (
              <Editor
                key={selected.id}
                item={selected}
                onSave={async (patch) => { await updateItem(selected.id, patch); showFlash("Changes saved"); }}
                onApprove={async () => { await approveItem(selected.id); showFlash(`${selected.title} approved`); }}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

function Editor({ item, onSave, onApprove }: { item: ContentItem; onSave: (p: ContentItemPatch) => Promise<void>; onApprove: () => Promise<void> }) {
  const { items, guide } = useWorkspace();
  // Suggestions = defaults + guide theme cards + themes already used on other items.
  const themeSuggestions = [...new Set([...THEME_OPTIONS, ...guide.themes.map((t) => t.name), ...items.map((i) => i.theme)])].filter(Boolean);
  const initial = { text: item.text, theme: item.theme, contentType: item.contentType, note: item.note };
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => draft[k] !== initial[k]);
  const clean = { ...draft, theme: draft.theme.trim() };

  const act = async (fn: () => Promise<void>) => {
    setSaving(true);
    try { await fn(); } catch { /* error banner */ } finally { setSaving(false); }
  };

  return (
    <section className="panel panel--padded editor">
      <p className="eyebrow">{item.kind} <span aria-hidden>/</span> Source: {item.sourceFileName}</p>
      <div className="editor__title">
        <h2 className="h2">{item.heading}</h2>
        {item.pendingCount ? <Badge>Needs review</Badge> : <Badge tone="green">Approved</Badge>}
      </div>

      <label className="field field--first">
        <span className="field__label">{item.fieldLabel}</span>
        <textarea className="input input--lg" rows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
        <span className="caption-sm">Source: {item.sourceLocation}</span>
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field__label">Theme</span>
          {/* Free text with suggestions: pick a theme already in use or type a new one. */}
          <input
            className="input"
            list="theme-suggestions"
            value={draft.theme}
            placeholder="Type or choose a theme"
            onChange={(e) => setDraft({ ...draft, theme: e.target.value })}
          />
          <datalist id="theme-suggestions">
            {themeSuggestions.map((o) => <option key={o} value={o} />)}
          </datalist>
        </label>
        <label className="field">
          <span className="field__label">Content type</span>
          <select className="input" value={draft.contentType} onChange={(e) => setDraft({ ...draft, contentType: e.target.value })}>
            {[...new Set([draft.contentType, ...CONTENT_TYPE_OPTIONS])].filter(Boolean).map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field__label">Editorial note (optional)</span>
        <textarea className="input input--note" rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      </label>

      <hr className="rule rule--light" />
      <p className="caption-sm">Original file is preserved. Changes here apply to STILL only.</p>

      <div className="editor__actions">
        <button type="button" className="btn btn--secondary" onClick={() => setDraft(initial)}>Discard changes</button>
        <button type="button" className="btn btn--primary" aria-disabled={!dirty || saving} onClick={() => dirty && !saving && act(() => onSave(clean))}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="btn btn--approve" disabled={!item.pendingCount || saving} onClick={() => act(onApprove)}>
          {item.pendingCount ? "Approve item" : "Approved"}
        </button>
      </div>
      <p className="caption-sm">Approval status is tracked per item. Only approved content appears in the visitor-facing guide.</p>
    </section>
  );
}
