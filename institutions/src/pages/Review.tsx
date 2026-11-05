import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ContentItem, ContentItemPatch, MediaAsset, MediaAssetPatch, ReviewStatus } from "../api";
import { CONTENT_TYPE_OPTIONS, THEME_OPTIONS } from "../constants";
import { formatAdded } from "../format";
import { approvalBlocker, bulkApprovable, duplicateOriginal, isLowConfidence, NO_PERMISSION, rightsIssue } from "../rules";
import { useWorkspace } from "../store";
import { Badge, EmptyState, NoExhibition, PageHead, type Tone } from "../ui";

type Filter = "all" | ReviewStatus | "removed";

const no = (i: ContentItem) => String(i.order).padStart(2, "0");
const STATUS: Record<ReviewStatus, { label: string; tone: Tone; text: string }> = {
  IN_REVIEW: { label: "In review", tone: "gray", text: "tone-amber" },
  APPROVED: { label: "Approved", tone: "green", text: "tone-green" },
  REJECTED: { label: "Rejected", tone: "gray", text: "tone-gray" },
};

export default function Review() {
  const { exhibition, items, counts, approveItem, rejectItem, createExhibition, can } = useWorkspace();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<"source" | "attention">("source");
  const [flash, setFlash] = useState<string | null>(null);
  // Handoff 4.2: bulk actions only on a clear selection, with a confirmation step on the page.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const visible = useMemo(() => {
    let list = items.filter((i) =>
      filter === "removed" ? i.removed : !i.removed && (filter === "all" || i.reviewStatus === filter),
    );
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

  const reviewer = can("review");
  const ready = items.filter((i) => !i.removed && bulkApprovable(i, items));
  const pickedItems = items.filter((i) => picked.has(i.id) && !i.removed && i.reviewStatus === "IN_REVIEW");
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
    showFlash(`${done} groups ${kind === "approve" ? "approved" : "rejected"}${skipped ? ` · ${skipped} skipped (needs a closer look or could not be saved)` : ""}`);
  };

  const filters: [Filter, string][] = [
    ["all", `All ${counts.total}`],
    ["IN_REVIEW", `In review ${counts.needReview}`],
    ["APPROVED", `Approved ${counts.approved}`],
    ["REJECTED", `Rejected ${counts.rejected}`],
    ["removed", `Removed ${counts.removed}`],
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
          <span className="muted">{counts.total} items found · {counts.approved} approved · {counts.needReview} need attention</span>
        </div>
        <div className="toolbar__actions">
          <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials/preview")}>Preview digital guide</button>
          {reviewer && (
            <button type="button" className="btn btn--primary btn--wide" onClick={selectReady} disabled={!counts.total}>
              Approve all ready{ready.length ? ` (${ready.length})` : ""}
            </button>
          )}
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
          {reviewer && pickedItems.length > 0 && (
            <div className="bulkbar" role="region" aria-label="Selected items">
              {confirming ? (
                <>
                  <p>
                    <strong>{confirming === "approve" ? "Approve" : "Reject"} {pickedItems.length} groups ({pickedItems.reduce((n, i) => n + i.itemCount, 0)} entries)?</strong>{" "}
                    {pickedItems.map((i) => `${no(i)} ${i.title}`).join(", ")}
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

          <div className="split split--review">
            <section className="panel">
              <div className="panel__head">
                <span className="eyebrow">Extracted content</span>
                <span className="eyebrow">{visible.length} groups</span>
              </div>
              <ul className="item-list">
                {visible.map((i) => (
                  <li key={i.id} className="pick-row">
                    {reviewer && (
                      <input
                        type="checkbox"
                        className="pick-row__box"
                        aria-label={`Select ${i.title}`}
                        disabled={i.removed || i.reviewStatus !== "IN_REVIEW"}
                        checked={picked.has(i.id)}
                        onChange={() => togglePick(i.id)}
                      />
                    )}
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
                onGone={() => setSelectedId(null)}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

function ItemFlags({ item, items }: { item: ContentItem; items: ContentItem[] }) {
  if (item.removed) return <span className="item__status tone-gray">Removed</span>;
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
  onGone: () => void;
}

function Editor({ item, flash, onOpen, onGone }: EditorProps) {
  const { items, guide, can, updateItem, approveItem, rejectItem, reopenItem, removeItem, restoreItem, dismissDuplicate, mergeItems, splitItem } = useWorkspace();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const editable = can("edit");
  const reviewer = can("review");
  // Suggestions = defaults + guide theme cards + themes already used on other items.
  const themeSuggestions = [...new Set([...THEME_OPTIONS, ...guide.themes.map((t) => t.name), ...items.map((i) => i.theme)])].filter(Boolean);
  const initial = { text: item.text, theme: item.theme, contentType: item.contentType, note: item.note };
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => draft[k] !== initial[k]);
  const clean: ContentItemPatch = { ...draft, theme: draft.theme.trim() };
  const original = duplicateOriginal(item, items);
  const blocker = approvalBlocker(item, items);

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    setSaving(true);
    try { await fn(); if (msg) flash(msg); } catch { /* error banner */ } finally { setSaving(false); }
  };
  const approve = () => act(async () => {
    if (dirty) await updateItem(item.id, clean);
    await approveItem(item.id);
  }, `${item.title} approved`);
  const split = () => act(async () => {
    const at = textRef.current?.selectionStart ?? 0;
    if (dirty) await updateItem(item.id, clean);
    await splitItem(item.id, at);
  }, `${item.title} split in two`);
  const remove = () => act(async () => { await removeItem(item.id); onGone(); }, `${item.title} deleted · find it under Removed`);

  const eyebrow = (
    <p className="eyebrow">
      {item.kind} <span aria-hidden>/</span> Source: {item.sourceFileName}
      {item.updatedBy && <> <span aria-hidden>·</span> Last edited by {item.updatedBy}{item.updatedAt && `, ${formatAdded(item.updatedAt)}`}</>}
    </p>
  );

  if (item.removed) {
    return (
      <section className="panel panel--padded editor">
        {eyebrow}
        <div className="editor__title">
          <h2 className="h2">{item.heading}</h2>
          <Badge>Removed</Badge>
        </div>
        <p className="editor__text-preview">{item.text}</p>
        <div className="notice">
          <p>Deleted from the guide dataset. It is not shown to visitors and does not count toward review.</p>
          {editable && (
            <div className="notice__actions">
              <button type="button" className="link-btn" disabled={saving} onClick={() => act(() => restoreItem(item.id), `${item.title} restored`)}>Restore item</button>
            </div>
          )}
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
          <p><strong>Possible duplicate</strong> of {no(original)} {original.title} ({original.sourceFileName}). Compare them, then delete one or keep both.</p>
          <div className="notice__actions">
            <button type="button" className="link-btn" onClick={() => onOpen(original.id)}>Open {no(original)}</button>
            {editable && <button type="button" className="link-btn" disabled={saving} onClick={() => act(async () => { await mergeItems(item.id, original.id, "into"); onGone(); }, `Merged into ${no(original)}, keeping its text`)}>Merge · keep {no(original)}'s text</button>}
            {editable && <button type="button" className="link-btn" disabled={saving} onClick={() => act(async () => { await mergeItems(item.id, original.id, "this"); onGone(); }, `Merged into ${no(original)}, keeping this text`)}>Merge · keep this text</button>}
            {editable && <button type="button" className="link-btn" disabled={saving} onClick={remove}>Delete this item</button>}
            {editable && <button type="button" className="link-btn" disabled={saving} onClick={() => act(() => dismissDuplicate(item.id), "Kept both items")}>Keep both</button>}
          </div>
        </div>
      )}

      <fieldset className="plain-fieldset" disabled={!editable}>
        <label className="field field--first">
          <span className="field__label">{item.fieldLabel}</span>
          <textarea ref={textRef} className="input input--lg" rows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <span className="field__foot">
            <span className="caption-sm">Source: {item.sourceLocation}{item.confidence !== null && ` · confidence ${Math.round(item.confidence * 100)}%`}</span>
            {editable && <button type="button" className="link-btn" disabled={saving} onClick={split} title="Put the cursor where the second item should start">Split at cursor</button>}
          </span>
        </label>
        {draft.text !== item.originalText && (
          <details className="original">
            <summary className="caption-sm">Original extracted text</summary>
            <p>{item.originalText}</p>
            <button type="button" className="link-btn" onClick={() => setDraft({ ...draft, text: item.originalText })}>Use original</button>
          </details>
        )}

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

      {item.assets.length > 0 && <Assets item={item} canEditRights={editable || reviewer} flash={flash} />}

      <hr className="rule rule--light" />
      <p className="caption-sm">Original file is preserved. Changes here apply to STILL only.</p>

      <div className="editor__actions">
        {editable && (
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setDraft(initial)}>Discard changes</button>
            <button type="button" className="btn btn--primary" aria-disabled={!dirty || saving} onClick={() => dirty && !saving && act(() => updateItem(item.id, clean), "Changes saved")}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        )}
        {reviewer && item.reviewStatus === "IN_REVIEW" && (
          <>
            <button type="button" className={`btn btn--approve${blocker ? " is-blocked" : ""}`} disabled={!!blocker || saving} onClick={approve}>
              {dirty ? "Save & approve" : "Approve item"}
            </button>
            <button type="button" className="link-btn link-btn--strong" disabled={saving} onClick={() => act(() => rejectItem(item.id), `${item.title} rejected`)}>Reject</button>
          </>
        )}
        {reviewer && item.reviewStatus === "APPROVED" && (
          <button type="button" className="link-btn link-btn--strong" disabled={saving} onClick={() => act(() => reopenItem(item.id), `${item.title} returned to review`)}>Return to review</button>
        )}
        {editable && <button type="button" className="link-btn editor__remove" disabled={saving} onClick={remove}>Delete from guide data</button>}
      </div>
      {reviewer && item.reviewStatus === "IN_REVIEW" && blocker && <p className="caption-sm tone-amber">{blocker}</p>}
      {item.reviewStatus === "REJECTED" && <p className="caption-sm">A rejected item is final. To use the text again, add it as a new item.</p>}
      {!editable && !reviewer && <p className="caption-sm">{NO_PERMISSION.edit}</p>}
      <p className="caption-sm">Only approved content appears in the visitor guide. Rejected and in-review items are left out; deleted items can be restored from Removed.</p>
    </section>
  );
}

const PERMISSIONS: { value: MediaAsset["usagePermission"]; label: string }[] = [
  { value: "UNKNOWN", label: "Not confirmed" },
  { value: "GRANTED", label: "Granted" },
  { value: "DENIED", label: "Denied" },
];

/** Handoff 6 RightsRecord, one per image. Missing rights block publishing that image, not approving the text. */
function Assets({ item, canEditRights, flash }: { item: ContentItem; canEditRights: boolean; flash: (msg: string) => void }) {
  return (
    <section className="assets">
      <p className="field__label">Images &amp; copyright · {item.assets.length}</p>
      <p className="caption-sm">Uploading a file does not grant publication rights. An image without confirmed rights is not published, even when the text is approved.</p>
      {item.assets.map((a) => <AssetRights key={a.id} itemId={item.id} asset={a} editable={canEditRights} flash={flash} />)}
    </section>
  );
}

function AssetRights({ itemId, asset, editable, flash }: { itemId: string; asset: MediaAsset; editable: boolean; flash: (msg: string) => void }) {
  const { updateAsset } = useWorkspace();
  const initial = {
    creator: asset.creator, copyrightHolder: asset.copyrightHolder, imageSource: asset.imageSource,
    usagePermission: asset.usagePermission, usageScope: asset.usageScope, expiresOn: asset.expiresOn ?? "", excluded: asset.excluded,
  };
  const [d, setD] = useState(initial);
  const [open, setOpen] = useState(!!rightsIssue(asset));
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const issue = rightsIssue({ ...asset, ...d, expiresOn: d.expiresOn || null });
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });

  const save = async () => {
    const patch: MediaAssetPatch = {
      ...d, creator: d.creator.trim(), copyrightHolder: d.copyrightHolder.trim(), imageSource: d.imageSource.trim(),
      usageScope: d.usageScope.trim(), expiresOn: d.expiresOn || null,
    };
    try { await updateAsset(itemId, asset.id, patch); flash("Image rights saved"); } catch { /* error banner */ }
  };

  return (
    <div className={`asset${d.excluded ? " is-excluded" : ""}`}>
      <button type="button" className="asset__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="asset__thumb" aria-hidden>IMG</span>
        <span className="asset__name">
          <span className="strong">{asset.caption}</span>
          <span className="caption-sm">{asset.imageSource || "Source not recorded"}</span>
        </span>
        {d.excluded ? <Badge>Not published</Badge> : issue ? <Badge tone="amber">{issue}</Badge> : <Badge tone="green">Rights confirmed</Badge>}
      </button>
      {open && (
        <fieldset className="plain-fieldset asset__body" disabled={!editable}>
          <div className="field-row">
            <label className="field"><span className="field__label">Creator</span><input className="input" value={d.creator} onChange={set("creator")} /></label>
            <label className="field"><span className="field__label">Copyright holder</span><input className="input" value={d.copyrightHolder} onChange={set("copyrightHolder")} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span className="field__label">Image source</span><input className="input" value={d.imageSource} onChange={set("imageSource")} /></label>
            <label className="field">
              <span className="field__label">Usage permission</span>
              <select className="input" value={d.usagePermission} onChange={set("usagePermission")}>
                {PERMISSIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field"><span className="field__label">Usage scope</span><input className="input" value={d.usageScope} placeholder="Digital guide, exhibition period" onChange={set("usageScope")} /></label>
            <label className="field"><span className="field__label">Permission expires</span><input className="input" type="date" value={d.expiresOn} onChange={set("expiresOn")} /></label>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={d.excluded} onChange={(e) => setD({ ...d, excluded: e.target.checked })} />
            <span>Don't publish this image (the text can still be used)</span>
          </label>
          <div className="asset__actions">
            {asset.reviewedBy && <span className="caption-sm">Last checked by {asset.reviewedBy}{asset.reviewedAt && `, ${formatAdded(asset.reviewedAt)}`}</span>}
            {editable && <button type="button" className="btn btn--secondary" aria-disabled={!dirty} onClick={() => dirty && save()}>Save image rights</button>}
          </div>
        </fieldset>
      )}
    </div>
  );
}
