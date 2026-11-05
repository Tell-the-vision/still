import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ContentItem, ContentItemPatch, MediaAsset, MediaAssetPatch, ReviewStatus, StillDoc } from "../api";
import type { JSONContent } from "@tiptap/react";
import { api } from "../api";
import { Editor as RichEditor } from "../editor/Editor";
import { CONTENT_TYPE_OPTIONS, THEME_OPTIONS } from "../constants";
import { formatAdded } from "../format";
import { approvalBlocker, bulkApprovable, duplicateOriginal, isLowConfidence, RIGHTS_LABEL, rightsIssue } from "../rules";
import { VisitorPreview, VISITOR_PREVIEW_NOTICE } from "../editor/VisitorPreview";
import { SourceMarks } from "../editor/SourceMarks";
import { Suggestions } from "../editor/Suggestions";
import { WideSuggestions } from "../editor/WideSuggestions";
import { useWorkspace } from "../store";
import { Badge, EmptyState, NoExhibition, PageHead, type Tone } from "../ui";

type Filter = "all" | ReviewStatus;

const no = (i: ContentItem) => String(i.order).padStart(2, "0");
const STATUS: Record<ReviewStatus, { label: string; tone: Tone; text: string }> = {
  IN_REVIEW: { label: "In review", tone: "gray", text: "tone-amber" },
  APPROVED: { label: "Approved", tone: "green", text: "tone-green" },
  REJECTED: { label: "Rejected", tone: "gray", text: "tone-gray" },
};

export default function Review() {
  const { exhibition, items, counts, approveItem, rejectItem, createExhibition } = useWorkspace();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // SPEC §9.4 미리보기 모드: the preview follows the editor before autosave lands.
  const [liveDoc, setLiveDoc] = useState<{ itemId: string; doc: JSONContent } | null>(null);
  const [sort, setSort] = useState<"source" | "attention">("source");
  const [flash, setFlash] = useState<string | null>(null);
  // Handoff 4.2: bulk actions only on a clear selection, with a confirmation step on the page.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // The visitor preview is a third column from 1280px up; below that it starts hidden.
  const [showPreview, setShowPreview] = useState(() => window.innerWidth >= 1280);

  const visible = useMemo(() => {
    let list = items.filter((i) => filter === "all" || i.reviewStatus === filter);
    if (sort === "attention") {
      const weight = (i: ContentItem) => (i.reviewStatus === "IN_REVIEW" ? 2 : 0) + (isLowConfidence(i) || i.duplicateOf ? 1 : 0);
      list = [...list].sort((a, b) => weight(b) - weight(a));
    }
    return list;
  }, [items, filter, sort]);

  if (!exhibition) return <NoExhibition title="Review extracted content" onCreate={createExhibition} />;

  // Default selection: first visible item in review, else the first visible item.
  const selected = items.find((i) => i.id === selectedId) ?? visible.find((i) => i.reviewStatus === "IN_REVIEW") ?? visible[0] ?? null;
  const hasItems = items.length > 0;

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2600);
  };

  const ready = items.filter((i) => bulkApprovable(i, items));
  const pickedItems = items.filter((i) => picked.has(i.id) && i.reviewStatus === "IN_REVIEW");
  const togglePick = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectReady = () => {
    if (!ready.length) { showFlash("Nothing is ready for bulk approval. Review the remaining items one by one."); return; }
    setPicked(new Set(ready.map((i) => i.id)));
    setConfirming("approve");
  };
  const runBulk = async (kind: "approve" | "reject") => {
    setBulkBusy(true);
    let done = 0;
    let skipped = 0;
    for (const i of pickedItems) {
      if (kind === "approve" && approvalBlocker(i, items)) { skipped++; continue; }
      try { await (kind === "approve" ? approveItem(i.id) : rejectItem(i.id)); done++; } catch { skipped++; }
    }
    setBulkBusy(false);
    setConfirming(null);
    setPicked(new Set());
    showFlash(`${done} ${done === 1 ? "group" : "groups"} ${kind === "approve" ? "approved" : "rejected"}${skipped ? ` · ${skipped} skipped (needs a closer look or could not be saved)` : ""}`);
  };

  const filters: [Filter, string][] = [
    ["all", `All ${counts.total}`],
    ["IN_REVIEW", `In review ${counts.needReview}`],
    ["APPROVED", `Approved ${counts.approved}`],
    ["REJECTED", `Rejected ${counts.rejected}`],
  ];

  return (
    <>
      <PageHead
        eyebrow={<>Exhibition setup <span aria-hidden>/</span> Step 02</>}
        title="Review extracted content"
        lede="STILL has organised your files into editable content. Review each item before publishing."
      />
      <div className="toolbar">
        <div className="toolbar__summary">
          {hasItems ? <Badge tone="green" className="badge--wide">Analysis complete</Badge> : <Badge className="badge--wide">No analysis yet</Badge>}
          <span className="muted">{counts.total} {counts.total === 1 ? "item" : "items"} found · {counts.approved} approved · {counts.needReview} {counts.needReview === 1 ? "needs" : "need"} attention</span>
        </div>
        <div className="toolbar__actions">
          <button type="button" className="btn btn--secondary" aria-pressed={showPreview} onClick={() => setShowPreview((v) => !v)}>Preview</button>
          <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials/preview")}>Preview digital guide</button>
          <button type="button" className="btn btn--primary btn--wide" onClick={selectReady} disabled={!counts.total}>
            Approve all ready{ready.length ? ` (${ready.length})` : ""}
          </button>
        </div>
      </div>
      <hr className="rule rule--tight" />

      {!hasItems ? (
        <EmptyState
          title="No extracted content yet"
          body="Upload materials and start analysis. Extracted items will appear here for review."
          action={<button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials")}>Go to upload</button>}
        />
      ) : (
        <>
          <div className="filterbar">
            <div className="chips" role="tablist" aria-label="Filter content">
              {filters.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} className={`chip chip--btn${filter === key ? " is-active" : ""}`} onClick={() => { setFilter(key); setSelectedId(null); }}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="sort" onClick={() => setSort((s) => (s === "source" ? "attention" : "source"))}>
              Sort: {sort === "source" ? "Source order" : "Needs attention"} <span aria-hidden>▾</span>
            </button>
          </div>
          {flash && <p className="flash" role="status">{flash}</p>}
          <WideSuggestions editable flash={showFlash} />
          {pickedItems.length > 0 && (
            <div className="bulkbar" role="region" aria-label="Selected items">
              {confirming ? (
                <>
                  <p>
                    <strong>{confirming === "approve" ? "Approve" : "Reject"} {pickedItems.length} {pickedItems.length === 1 ? "group" : "groups"} ({pickedItems.reduce((n, i) => n + i.itemCount, 0)} entries)?</strong>{" "}
                    {pickedItems.map((i) => `${no(i)} ${i.title}`).join(", ")}
                    {confirming === "reject" && " Rejected items cannot be brought back."}
                  </p>
                  <span className="bulkbar__actions">
                    <button type="button" className="btn btn--primary" disabled={bulkBusy} onClick={() => runBulk(confirming)}>{bulkBusy ? "Working…" : `Confirm ${confirming}`}</button>
                    <button type="button" className="link-btn" onClick={() => setConfirming(null)}>Cancel</button>
                  </span>
                </>
              ) : (
                <>
                  <p><strong>{pickedItems.length} selected</strong> · low-confidence items, AI suggestions and possible duplicates are never selected by "Approve all ready".</p>
                  <span className="bulkbar__actions">
                    <button type="button" className="btn btn--approve" onClick={() => setConfirming("approve")}>Approve selected</button>
                    <button type="button" className="link-btn link-btn--strong" onClick={() => setConfirming("reject")}>Reject selected</button>
                    <button type="button" className="link-btn" onClick={() => setPicked(new Set())}>Clear</button>
                  </span>
                </>
              )}
            </div>
          )}

          <div className={`split split--review${showPreview && selected?.doc ? " split--review-preview" : ""}`}>
            <section className="panel">
              <div className="panel__head">
                <span className="eyebrow">Extracted content</span>
                <span className="eyebrow">{visible.length} {visible.length === 1 ? "group" : "groups"}</span>
              </div>
              <ul className="item-list">
                {visible.map((i) => (
                  <li key={i.id} className="pick-row">
                    {/* The label is the 24×24 target around the 15px box (WCAG 2.5.8). */}
                    <label className="pick-row__hit">
                      <input
                        type="checkbox"
                        className="pick-row__box"
                        aria-label={`Select ${i.title}`}
                        disabled={i.reviewStatus !== "IN_REVIEW"}
                        checked={picked.has(i.id)}
                        onChange={() => togglePick(i.id)}
                      />
                    </label>
                    <button type="button" className={`item${i.id === selected?.id ? " is-selected" : ""}`} onClick={() => setSelectedId(i.id)}>
                      <span className="item__no">{no(i)}</span>
                      <span className="item__body">
                        <span className="item__title">{i.title}</span>
                        <span className="item__meta">{i.summary}</span>
                        <ItemFlags item={i} items={items} />
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
                flash={showFlash}
                onOpen={(id) => { setFilter("all"); setSelectedId(id); }}
                onDoc={(doc) => setLiveDoc({ itemId: selected.id, doc })}
              />
            )}

            {showPreview && selected?.doc && (
              <aside className="visitor-preview-pane">
                <p className="visitor-preview-pane__notice">{VISITOR_PREVIEW_NOTICE}</p>
                <VisitorPreview doc={liveDoc?.itemId === selected.id ? (liveDoc.doc as StillDoc) : selected.doc} />
              </aside>
            )}
          </div>
        </>
      )}
    </>
  );
}

function ItemFlags({ item, items }: { item: ContentItem; items: ContentItem[] }) {
  const rightsOpen = item.assets.filter((a) => rightsIssue(a)).length;
  return (
    <span className="item__flags">
      <span className={`item__status ${STATUS[item.reviewStatus].text}`}>{STATUS[item.reviewStatus].label}</span>
      {item.origin === "AI_SUGGESTION" && <span className="item__status tone-amber">AI suggestion</span>}
      {isLowConfidence(item) && <span className="item__status tone-amber">Low confidence</span>}
      {duplicateOriginal(item, items) && <span className="item__status tone-amber">Possible duplicate</span>}
      {rightsOpen > 0 && <span className="item__status tone-amber">Image rights · {rightsOpen}</span>}
    </span>
  );
}

interface EditorProps {
  item: ContentItem;
  flash: (msg: string) => void;
  onOpen: (itemId: string) => void;
  onDoc: (doc: JSONContent) => void;
}

function Editor({ item, flash, onOpen, onDoc }: EditorProps) {
  const { exhibition, items, updateItem, approveItem, rejectItem, reopenItem, dismissDuplicate, syncItem } = useWorkspace();
  // Everyone in an institution has the same permissions (SPEC §9.2); a rejected item is final (§10.8).
  const editable = item.reviewStatus !== "REJECTED";
  const themeSuggestions = [...new Set([...THEME_OPTIONS, ...items.map((i) => i.theme)])].filter(Boolean);
  // The text itself lives in the rich editor, which saves on its own; this form holds the details only.
  // (Sending the text from here too used to overwrite the editor's saves with the text the form was opened with.)
  const initial = { theme: item.theme, contentType: item.contentType, note: item.note };
  const [draft, setDraft] = useState(initial);
  // The editor remounts (and reloads the document) only when the item changed outside it: a suggestion
  // accepted, a block reverted, another tab. Its own autosaves move the revision without a remount.
  const ownRevisions = useRef(new Set<string>());
  const [mountedRevision, setMountedRevision] = useState(item.revision);
  useEffect(() => {
    if (item.revision && !ownRevisions.current.has(item.revision)) setMountedRevision(item.revision);
  }, [item.revision]);
  const saved = (next: ContentItem) => {
    if (next.revision) ownRevisions.current.add(next.revision);
    syncItem(next);
  };
  const [saving, setSaving] = useState(false);
  // Rejecting is final (SPEC §10.8), so it always asks once on the page.
  const [confirmReject, setConfirmReject] = useState(false);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => draft[k] !== initial[k]);
  const clean: ContentItemPatch = { ...draft, theme: draft.theme.trim() };
  const original = duplicateOriginal(item, items);
  const blocker = approvalBlocker(item, items);
  const rejected = item.reviewStatus === "REJECTED";

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    setSaving(true);
    try { await fn(); if (msg) flash(msg); } catch { /* error banner */ } finally { setSaving(false); }
  };
  const approve = () => act(async () => {
    if (dirty) await updateItem(item.id, clean);
    await approveItem(item.id);
  }, `${item.title} approved`);
  const reject = () => act(async () => { await rejectItem(item.id); setConfirmReject(false); }, `${item.title} rejected`);

  const eyebrow = (
    <p className="eyebrow">
      {item.kind} <span aria-hidden>/</span> Source: {item.sourceFileName}
      {item.updatedBy && <> <span aria-hidden>·</span> Last edited by {item.updatedBy}{item.updatedAt && `, ${formatAdded(item.updatedAt)}`}</>}
    </p>
  );

  if (rejected) {
    return (
      <section className="panel panel--padded editor">
        {eyebrow}
        <div className="editor__title">
          <h2 className="h2">{item.heading}</h2>
          <Badge>Rejected</Badge>
        </div>
        <p className="editor__text-preview">{item.text}</p>
        <div className="notice">
          <p>Rejected. It is not in the guide, and a rejected item cannot be brought back.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel panel--padded editor">
      {eyebrow}
      <div className="editor__title">
        <h2 className="h2">{item.heading}</h2>
        <Badge tone={STATUS[item.reviewStatus].tone}>{STATUS[item.reviewStatus].label}</Badge>
      </div>

      <Suggestions itemId={item.id} editable={editable} flash={flash} />

      {item.origin === "AI_SUGGESTION" && (
        <div className="notice notice--amber" role="note">
          <p><strong>AI suggestion.</strong> STILL wrote this from your materials. It is not a curator statement or an artist quotation, and visitors must never see it attributed to either. Approve only if you want to use it as guide copy.</p>
        </div>
      )}
      {isLowConfidence(item) && (
        <div className="notice notice--amber" role="note">
          <p><strong>Low extraction confidence ({Math.round((item.confidence ?? 0) * 100)}%).</strong> Check it against {item.sourceLocation}. It is never approved in bulk.</p>
        </div>
      )}
      {original && (
        <div className="notice notice--amber" role="note">
          <p><strong>Possible duplicate</strong> of {no(original)} {original.title} ({original.sourceFileName}). Compare them, then reject one or keep both.</p>
          <div className="notice__actions">
            <button type="button" className="link-btn" onClick={() => onOpen(original.id)}>Open {no(original)}</button>
            <button type="button" className="link-btn" disabled={saving} onClick={() => setConfirmReject(true)}>Reject this item</button>
            <button type="button" className="link-btn" disabled={saving} onClick={() => act(() => dismissDuplicate(item.id), "Kept both items")}>Keep both</button>
          </div>
        </div>
      )}

      <fieldset className="plain-fieldset" disabled={!editable}>
        <div className="field field--first" role="group" aria-labelledby="editor-label">
          <span className="field__label" id="editor-label">{item.fieldLabel}</span>
          <RichEditor key={`${item.id}:${mountedRevision ?? ""}`} itemId={item.id} exhibitionId={exhibition?.id ?? ""} doc={api.getContentDoc(item.id) as JSONContent} editable={editable} onChange={onDoc} onSaved={saved} />
          <span className="field__foot">
            <span className="caption-sm">Source: {item.sourceLocation}{item.confidence !== null && ` · confidence ${Math.round(item.confidence * 100)}%`}</span>
          </span>
        </div>
        {/* SPEC §9.4 원문 대조 표시: which blocks still read as their source, with "Revert to source" for the edited ones. */}
        <details className="original">
          <summary className="caption-sm">Source comparison</summary>
          <SourceMarks item={item} />
        </details>
      </fieldset>

      <section className="details" aria-labelledby="details-label">
        <h3 className="field__label" id="details-label">Details</h3>
        <fieldset className="plain-fieldset" disabled={!editable}>
        <div className="field-row">
          <label className="field">
            <span className="field__label">Theme</span>
            {/* Free text with suggestions: pick a theme already in use or type a new one. */}
            <input className="input" list="theme-suggestions" value={draft.theme} placeholder="Type or choose a theme" onChange={(e) => setDraft({ ...draft, theme: e.target.value })} />
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
        </fieldset>
        {item.assets.length > 0 && <Assets item={item} flash={flash} />}
      </section>

      <hr className="rule rule--light" />
      <p className="caption-sm">Original file is preserved. Changes here apply to STILL only.{item.reviewStatus === "APPROVED" && " Saving an edit sends the item back to review."}</p>

      <div className="editor__actions">
        <button type="button" className="btn btn--secondary" onClick={() => setDraft(initial)}>Discard changes</button>
        <button type="button" className="btn btn--primary" aria-disabled={!dirty || saving} onClick={() => dirty && !saving && act(() => updateItem(item.id, clean), "Changes saved")}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {item.reviewStatus === "IN_REVIEW" && (
          <button type="button" className={`btn btn--approve${blocker ? " is-blocked" : ""}`} disabled={!!blocker || saving} onClick={approve}>
            {dirty ? "Save & approve" : "Approve item"}
          </button>
        )}
        {item.reviewStatus === "APPROVED" && (
          <button type="button" className="link-btn link-btn--strong" disabled={saving} onClick={() => act(() => reopenItem(item.id), `${item.title} returned to review`)}>Return to review</button>
        )}
        {!confirmReject && <button type="button" className="link-btn link-btn--strong" disabled={saving} onClick={() => setConfirmReject(true)}>Reject</button>}
      </div>
      {confirmReject && (
        <div className="notice notice--amber" role="alert">
          <p><strong>Reject {item.title}?</strong> It leaves the guide and cannot be brought back.</p>
          <div className="notice__actions">
            <button type="button" className="link-btn link-btn--danger" disabled={saving} onClick={reject}>Reject permanently</button>
            <button type="button" className="link-btn" onClick={() => setConfirmReject(false)}>Cancel</button>
          </div>
        </div>
      )}
      {item.reviewStatus === "IN_REVIEW" && blocker && <p className="caption-sm tone-amber">{blocker}</p>}
      <p className="caption-sm">Only approved content appears in the visitor guide. In-review items are left out; rejected items are final.</p>
    </section>
  );
}

const RIGHTS: MediaAsset["rights"][] = ["UNCONFIRMED", "CONFIRMED", "RESTRICTED"];

/** One rights record per image (SPEC §10.7 images: rights, credit, alt text). Unconfirmed rights block publishing that image, not approving the text. */
function Assets({ item, flash }: { item: ContentItem; flash: (msg: string) => void }) {
  return (
    <section className="assets">
      <p className="field__label">Images &amp; copyright · {item.assets.length}</p>
      <p className="caption-sm">Uploading a file does not grant publication rights. Only images with confirmed rights are published, even when the text is approved.</p>
      {item.assets.map((a) => <AssetRights key={a.id} itemId={item.id} asset={a} flash={flash} />)}
    </section>
  );
}

function AssetRights({ itemId, asset, flash }: { itemId: string; asset: MediaAsset; flash: (msg: string) => void }) {
  const { updateAsset } = useWorkspace();
  const initial = { rights: asset.rights, credit: asset.credit ?? "", altText: asset.altText ?? "" };
  const [d, setD] = useState(initial);
  const [open, setOpen] = useState(!!rightsIssue(asset));
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const issue = rightsIssue({ ...asset, rights: d.rights });

  const save = async () => {
    const patch: MediaAssetPatch = { rights: d.rights, credit: d.credit.trim() || null, altText: d.altText.trim() || null };
    try { await updateAsset(itemId, asset.id, patch); flash("Image details saved"); } catch { /* error banner */ }
  };

  return (
    <div className="asset">
      <button type="button" className="asset__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="asset__thumb" aria-hidden>IMG</span>
        <span className="asset__name">
          <span className="strong">{asset.credit || "No credit yet"}</span>
          <span className="caption-sm">{asset.name}</span>
        </span>
        {issue ? <Badge tone="amber">{RIGHTS_LABEL[d.rights]}</Badge> : <Badge tone="green">{RIGHTS_LABEL[d.rights]}</Badge>}
      </button>
      {open && (
        <div className="asset__body">
          <label className="field">
            <span className="field__label">Rights</span>
            <select className="input" value={d.rights} onChange={(e) => setD({ ...d, rights: e.target.value as MediaAsset["rights"] })}>
              {RIGHTS.map((r) => <option key={r} value={r}>{RIGHTS_LABEL[r]}</option>)}
            </select>
            <span className="caption-sm">{d.rights === "RESTRICTED" ? "Not published. Take the item out of the guide, or confirm the rights later." : issue ? "Not published until the rights are confirmed." : "Published with the text."}</span>
          </label>
          <label className="field"><span className="field__label">Credit</span><input className="input" value={d.credit} placeholder="Artist, title, year. Photo credit." onChange={(e) => setD({ ...d, credit: e.target.value })} /></label>
          <label className="field"><span className="field__label">Alt text</span><input className="input" value={d.altText} placeholder="What the image shows, for screen readers" onChange={(e) => setD({ ...d, altText: e.target.value })} /></label>
          <div className="asset__actions">
            <button type="button" className="btn btn--secondary" aria-disabled={!dirty} onClick={() => dirty && save()}>Save image details</button>
          </div>
        </div>
      )}
    </div>
  );
}
