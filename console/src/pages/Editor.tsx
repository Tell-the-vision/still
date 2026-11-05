import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { AccountMenu } from "../AccountMenu";
import type { ContentItem, ReviewStatus, SourceFile, StillDoc } from "../api";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { api } from "../api";
import { Editor as RichEditor } from "../editor/Editor";
import { ARTWORK_TEMPLATE_CSV, UPLOAD_ACCEPT, UPLOAD_EXTENSIONS, UPLOAD_FORMATS_LABEL, UPLOAD_MAX_BYTES } from "../constants";
import { VISITOR_HOST } from "../format";
import { DevicePhoneMobileIcon, XMarkIcon } from "../icons";
import { approvalBlocker, bulkApprovable, duplicateOriginal, isLowConfidence, rightsIssue } from "../rules";
import { PhonePreview } from "../editor/PhonePreview";
import { Suggestions } from "../editor/Suggestions";
import { WideSuggestions } from "../editor/WideSuggestions";
import { useWorkspace } from "../store";
import { NoExhibition, type Tone } from "../ui";

const no = (i: ContentItem) => String(i.order).padStart(2, "0");
const STATUS: Record<ReviewStatus, { label: string; tone: Tone; text: string }> = {
  IN_REVIEW: { label: "In review", tone: "gray", text: "tone-amber" },
  APPROVED: { label: "Approved", tone: "green", text: "tone-green" },
  REJECTED: { label: "Rejected", tone: "gray", text: "tone-gray" },
};
// A file's state while it is not settled yet; a file that is read and analysed shows nothing.
const FILE_STATE: Partial<Record<SourceFile["status"], { label: string; tone: string }>> = {
  QUEUED: { label: "Queued", tone: "tone-gray" },
  UPLOADING: { label: "Uploading", tone: "tone-gray" },
  PROCESSING: { label: "Reading…", tone: "tone-gray" },
  CANCELED: { label: "Canceled", tone: "tone-gray" },
  FAILED: { label: "Failed", tone: "tone-amber" },
};
// SPEC §10.8 kind ARTWORK, shown with its label.
const isArtwork = (i: ContentItem) => i.kind === "Artwork";
const isLocal = (f: SourceFile) => ["QUEUED", "UPLOADING", "FAILED", "CANCELED"].includes(f.status);

/**
 * The editor (Figma A1 + A2, SPEC §9.4): the whole exhibition as one document. Files are dropped straight onto it;
 * each is read in the browser and analysed by itself (Gemini, via the Worker), and the items STILL structures
 * appear under the file they came from, edited in place (headings, text, quotes, lists, images) and approved
 * or rejected where they stand.
 */
export default function Editor() {
  const {
    exhibition, files, items, analysing, events, createExhibition, renameItem, publishAll, guide, approveItem, reopenItem, rejectItem, createArtwork, selectExhibition,
    uploadFiles, rejectFiles, retryUpload, cancelUpload, canRetry, dismissLocalFile, deleteFile, analysePending, startAnalysis, visitorDraft,
  } = useWorkspace();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // SPEC §9.4 미리보기 모드: the preview follows the editor before autosave lands.
  const [liveDoc, setLiveDoc] = useState<{ itemId: string; doc: JSONContent } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // A blank artwork just created: the editor opens on it with the caret in its title.
  const [freshId, setFreshId] = useState<string | null>(null);
  // Rejecting is final (SPEC §10.8), so the row asks once.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ rejected: true });
  // The "+ New" menu: a blank artwork, or files to draft from.
  const [newOpen, setNewOpen] = useState(false);
  const newMenu = useRef<HTMLSpanElement>(null);
  // The open + New menu closes on a click outside it or on Escape anywhere, like any menu.
  useEffect(() => {
    if (!newOpen) return;
    const away = (e: PointerEvent) => { if (!newMenu.current?.contains(e.target as Node)) setNewOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setNewOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", escape); };
  }, [newOpen]);
  const [publishing, setPublishing] = useState(false);
  // Set by a publish that just finished: Go to works settles in once as the next step.
  const [justPublished, setJustPublished] = useState(false);
  const [duplicates, setDuplicates] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  // The visitor preview starts open only where it fits beside the document (1600px and up).
  const [showPreview, setShowPreview] = useState(() => window.innerWidth >= 1600);
  // The phone loads the visitor app the first time it opens, then stays, so closing it animates too.
  const [phoneLoaded, setPhoneLoaded] = useState(showPreview);
  useEffect(() => { if (showPreview) setPhoneLoaded(true); }, [showPreview]);
  // The address names the open artwork, as a resource: /exhibitions/{code}/{first 8 characters of its id}. Opening
  // one (from the rail, or Edit in Go to works) sets it; arriving on it opens that exhibition, then that artwork.
  const { code, artwork } = useParams();
  const navigate = useNavigate();
  useEffect(() => { if (code && code !== exhibition?.id) selectExhibition(code); }, [code, exhibition?.id, selectExhibition]);
  useEffect(() => {
    const hit = artwork ? items.find((i) => i.id.startsWith(artwork)) : undefined;
    if (hit) setFocusedId(hit.id);
  }, [artwork, items]);
  // Files read on an earlier visit but never analysed are picked up when the editor opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void analysePending(); }, [exhibition?.id]);

  // The editor is organised by artwork (SPEC §10.8 kind ARTWORK: one content per artwork); the exhibition's
  // other texts (introduction, statements, sections) follow. Both keep source order.
  const artworks = useMemo(() => items.filter(isArtwork), [items]);
  const texts = useMemo(() => items.filter((i) => !isArtwork(i)), [items]);
  // Like a version-control panel, the rail lists the work still to do: what needs a decision and what is approved
  // (staged), plus what was rejected. Published artworks (committed) leave it and are listed in Go to works. An
  // artwork approved before the last publish is in the live guide; any edit since sends it back to review
  // (SPEC §10.8), so the approval time is enough to tell.
  const publishedAt = exhibition?.status === "PUBLISHED" ? exhibition.publishedAt : null;
  const isLive = (i: ContentItem) => i.reviewStatus === "APPROVED" && !!publishedAt && !!i.approvedAt && i.approvedAt <= publishedAt;
  const toReview = artworks.filter((i) => i.reviewStatus === "IN_REVIEW");
  // Approved since the last publish: what the next Publish All ships.
  const staged = artworks.filter((i) => i.reviewStatus === "APPROVED" && !isLive(i));
  // The artwork opened (from the rail, or from Go to works) always has a row: a published one shows under Approved,
  // checked, and unchecking it takes it out of the guide at the next Publish All, like unstaging a file.
  const picked = items.find((i) => i.id === focusedId) ?? null;
  const approvedList = artworks.filter((i) => i.reviewStatus === "APPROVED" && (!isLive(i) || i.id === picked?.id));
  const rejectedList = artworks.filter((i) => i.reviewStatus === "REJECTED");
  // "Approve all" leaves anything marked "!" for a person to approve one by one.
  const readyToApprove = toReview.filter((i) => bulkApprovable(i, items) && itemFlags(i, items).length === 0);
  const groupsGit: { key: string; label: string; list: ContentItem[]; action?: { label: string; title: string; disabled?: boolean; run: () => void } }[] = [
    {
      key: "review", label: "To review", list: toReview,
      action: toReview.length ? {
        label: "Approve all",
        title: readyToApprove.length < toReview.length ? "Approves the ones ready; anything that needs a closer look stays here" : "Approve every artwork here",
        disabled: readyToApprove.length === 0,
        run: () => { void Promise.all(readyToApprove.map((i) => approveItem(i.id))).catch(() => {}); },
      } : undefined,
    },
    {
      key: "approved", label: "Approved", list: approvedList,
      action: staged.length ? { label: "Unapprove all", title: "Send every approved artwork not published yet back to review", run: () => { void Promise.all(staged.map((i) => reopenItem(i.id))).catch(() => {}); } } : undefined,
    },
    { key: "rejected", label: "Rejected", list: rejectedList },
  ].filter((g) => g.list.length > 0); // empty groups are not shown, as in a version-control panel

  // Files not settled into artworks yet: uploading, reading, failed.
  const pending = files.filter((f) => FILE_STATE[f.status] || (analysing && f.status === "PROCESSED" && !items.some((i) => i.sourceFileName === f.name)));

  if (!exhibition) return <NoExhibition title="Editor" onCreate={createExhibition} />;

  const onServer = files.filter((f) => !isLocal(f));
  const uploadingCount = files.filter((f) => f.status === "QUEUED" || f.status === "UPLOADING" || f.status === "PROCESSING").length;
  const analysisFailed = events.some((ev) => ev.id === "classification" && ev.status === "FAILED");
  // With nothing picked, the first artwork still in progress; with nothing in progress, a blank page to start one.
  // An exhibition with only texts (no artworks yet) opens its first text.
  const focused = picked ?? toReview[0] ?? approvedList[0] ?? (artworks.length === 0 ? texts[0] ?? null : null);
  // The preview follows the editor before autosave lands; an item whose document is not loaded yet shows nothing.
  const previewDoc = !focused ? null : liveDoc?.itemId === focused.id ? (liveDoc.doc as StillDoc) : (() => {
    try { return api.getContentDoc(focused.id) as StillDoc; } catch { return null; }
  })();
  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2600);
  };
  const jumpTo = (id: string) => {
    setFocusedId(id);
    navigate(`/exhibitions/${exhibition.id}/${id.slice(0, 8)}`);
    window.scrollTo(0, 0);
  };

  // What the next Publish All would change: approved artworks that are not live yet (arriving), and artworks in the
  // guide that are no longer approved because they were unchecked or edited since (leaving).
  const approved = new Set(items.filter((i) => i.reviewStatus === "APPROVED").map((i) => i.id));
  const leaving = guide.sections.some((section) => section.contentIds.some((id) => !approved.has(id)));
  const arriving = items.some((i) => i.reviewStatus === "APPROVED" && !isLive(i));
  const toPublish = arriving || leaving || guide.hasUnpublishedChanges;
  // With the guide live and nothing waiting, the next step is the works and their QR labels: they take the emphasis.
  const worksNext = exhibition.status === "PUBLISHED" && !toPublish;

  // "Publish All" ships at once (SPEC §9.4 발행): every approved artwork and nothing else (the store's publishAll).
  // With every live artwork unchecked, nothing is left to show and the guide goes offline. A check the server still
  // refuses on shows in the error banner.
  const publish = async () => {
    if (publishing) return;
    if (approved.size === 0 && exhibition.status !== "PUBLISHED") { showFlash("Approve an artwork first, then publish."); return; }
    if (exhibition.status === "PUBLISHED" && !toPublish) { showFlash("Everything approved is already live."); return; }
    setPublishing(true);
    try {
      await publishAll();
      if (approved.size === 0) { showFlash("No artwork is approved, so the guide is offline."); return; }
      setJustPublished(true);
      showFlash(`Published · ${VISITOR_HOST}${exhibition.code}`);
      // The open artwork, if it just went live, leaves the rail with the rest: the editor moves on to the work left.
      if (focused?.reviewStatus === "APPROVED") { setFocusedId(null); navigate(`/exhibitions/${exhibition.id}`, { replace: true }); }
    } catch { /* error banner */ } finally {
      setPublishing(false);
    }
  };
  // Rendered later than it is written: it shows the bulk-upload panel defined below.
  const bar = () => (
    <>
      {/* The published works, each guide's QR code and link. */}
      <NavLink
        className={worksNext ? `rail-works--next${justPublished ? " rail-works--fresh" : ""}` : "link-btn doc-bar__action"}
        to={`/exhibitions/${exhibition.code}/works`}
        title="This exhibition's published works, with their QR codes and links"
        onAnimationEnd={() => setJustPublished(false)}
      >
        Go to works
      </NavLink>
      <span className="publish">
        <button type="button" className={`link-btn link-btn--strong doc-bar__action${worksNext ? " doc-bar__action--quiet" : ""}`} disabled={publishing} onClick={publish}>
          {publishing ? "Publishing…" : "Publish All"}
        </button>
      </span>
    </>
  );

  // Typing on the blank page creates the artwork with what was typed; the real editor takes over, caret at the end.
  const startFromDraft = async (doc: JSONContent) => {
    try {
      const created = await createArtwork(doc);
      setFocusedId(created.id);
      setFreshId(created.id);
    } catch { /* error banner */ }
  };

  // People start from nothing; STILL's drafts from files are a help, not the way in.
  const newArtwork = async () => {
    const id = () => crypto.randomUUID().slice(0, 8);
    try {
      const created = await createArtwork({ type: "doc", content: [{ type: "heading", attrs: { id: id(), level: 2 }, content: [] }, { type: "paragraph", attrs: { id: id() }, content: [] }] });
      setFocusedId(created.id);
      setFreshId(created.id);
    } catch { /* error banner */ }
  };

  // From a folder, files STILL cannot read (system files, other formats) are skipped instead of listed as failures.
  const addFiles = (incoming: FileList | null, fromFolder = false) => {
    const list = fromFolder
      ? [...(incoming ?? [])].filter((f) => !f.name.startsWith(".") && UPLOAD_EXTENSIONS.includes(f.name.split(".").pop()?.toLowerCase() ?? ""))
      : [...(incoming ?? [])];
    if (!list.length) return;
    const refused: { file: File; reason: string }[] = [];
    const fresh: File[] = [];
    const dupes: File[] = [];
    for (const f of list) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!UPLOAD_EXTENSIONS.includes(ext)) refused.push({ file: f, reason: `${ext.toUpperCase() || "This format"} is not supported yet. Use ${UPLOAD_FORMATS_LABEL}.` });
      else if (f.size > UPLOAD_MAX_BYTES) refused.push({ file: f, reason: "Over 100 MB." });
      // Handoff 9: warn on a duplicate name; never overwrite silently. (The server can also compare checksums.)
      else if (onServer.some((s) => s.name === f.name)) dupes.push(f);
      else fresh.push(f);
    }
    if (refused.length) rejectFiles(refused);
    if (dupes.length) setDuplicates((d) => [...d, ...dupes]);
    if (fresh.length) uploadFiles(fresh);
  };
  const resolveDuplicates = async (choice: "keep" | "replace" | "skip") => {
    const list = duplicates;
    setDuplicates([]);
    if (choice === "skip") return;
    if (choice === "replace") {
      for (const f of list) {
        const old = onServer.find((s) => s.name === f.name);
        if (old) await deleteFile(old.id).catch(() => {});
      }
    }
    uploadFiles(list);
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([ARTWORK_TEMPLATE_CSV], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "still-artwork-list-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };
  // Files can be dropped anywhere on the editor.
  const drop = {
    onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } },
    onDragLeave: (e: DragEvent) => { if (e.currentTarget === e.target) setDragging(false); },
    onDrop: (e: DragEvent) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); },
  };
  const folderInput = useRef<HTMLInputElement>(null);
  const picker = (
    <>
      <input ref={input} type="file" multiple accept={UPLOAD_ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      {/* A whole folder at once; the browser's own folder picker (webkitdirectory). */}
      <input ref={folderInput} type="file" multiple hidden {...{ webkitdirectory: "" }} onChange={(e) => { addFiles(e.target.files, true); e.target.value = ""; }} />
    </>
  );
  const duplicateNotice = duplicates.length > 0 && (
    <div className="notice notice--amber" role="alert">
      <p><strong>Already uploaded:</strong> {duplicates.map((f) => f.name).join(", ")}. Nothing is overwritten unless you choose Replace.</p>
      <div className="notice__actions">
        <button type="button" className="link-btn" onClick={() => resolveDuplicates("keep")}>Keep both</button>
        <button type="button" className="link-btn" onClick={() => resolveDuplicates("replace")}>Replace existing</button>
        <button type="button" className="link-btn" onClick={() => resolveDuplicates("skip")}>Don't upload</button>
      </div>
    </div>
  );

  return (
    <div className={`doc-layout${showPreview && focused ? " doc-layout--preview" : ""}${dragging ? " is-dragging" : ""}`} {...drop}>
      <nav className="doc-outline" aria-label="Exhibition outline">
        <div className="rail-brand">
          <NavLink to="/" className="wordmark">STILL.</NavLink>
          <AccountMenu className="account-menu--rail" />
        </div>
        <div className="doc-outline__head">
          <span className="eyebrow">Artworks</span>
          <span className="new-menu" ref={newMenu}>
            <button type="button" className="link-btn link-btn--strong" aria-haspopup="menu" aria-expanded={newOpen} onClick={() => setNewOpen((o) => !o)}>
              + New{uploadingCount > 0 && ` · ${uploadingCount}`}
            </button>
            {newOpen && (
              <div className="new-menu__panel" role="menu">
                <button type="button" role="menuitem" className="new-menu__item" onClick={() => { setNewOpen(false); void newArtwork(); }}>
                  Blank artwork
                </button>
                <button type="button" role="menuitem" className="new-menu__item" onClick={() => { setNewOpen(false); input.current?.click(); }}>
                  From files…
                </button>
                <button type="button" role="menuitem" className="new-menu__item" onClick={() => { setNewOpen(false); folderInput.current?.click(); }}>
                  From a folder…
                </button>
                <p className="new-menu__foot caption-sm">
                  STILL drafts from PDF, DOCX, XLSX, PPTX, images ·{" "}
                  <button type="button" className="link-btn link-btn--inline" onClick={() => { setNewOpen(false); downloadTemplate(); }} title="CSV: save it as .xlsx before uploading">template (save as .xlsx)</button>
                </p>
              </div>
            )}
          </span>
          {picker}
        </div>
        {/* Only the list scrolls; the brand, its header and the foot stay put. */}
        <div className="rail-scroll">
                  <ul className="item-list">
                    {/* A file shows here only until STILL has structured it into artworks. */}
                    {pending.map((file) => {
                      const state = FILE_STATE[file.status];
                      return (
                        <li key={file.id} className="file-pending" aria-label={file.name}>
                          <span className="dot dot--pending" aria-hidden />
                          <span className="file-pending__body">
                            <span className="item__title">{file.name}</span>
                            <span className={`caption-sm ${state?.tone ?? "tone-gray"}`}>
                              {state ? `${state.label}${file.status === "UPLOADING" ? ` ${file.progress ?? 0}%` : ""}` : "Drafting artworks…"}
                              {(file.status === "FAILED" || file.status === "CANCELED") && canRetry(file.id) && <> · <button type="button" className="link-btn link-btn--strong" onClick={() => retryUpload(file.id)}>Retry</button></>}
                            </span>
                            {file.error && <span className="caption-sm error">{file.error}</span>}
                          </span>
                          {(file.status === "QUEUED" || file.status === "UPLOADING")
                            ? <button type="button" className="file-group__x" onClick={() => cancelUpload(file.id)} aria-label={`Cancel ${file.name}`}>×</button>
                            : <button type="button" className="file-group__x" onClick={() => (isLocal(file) ? dismissLocalFile(file.id) : deleteFile(file.id).catch(() => {}))} aria-label={`Remove ${file.name}`}>×</button>}
                        </li>
                      );
                    })}
                    {groupsGit.map((g) => (
                      <li key={g.key} className="git-group">
                        <div className="git-group__head">
                          <button type="button" className="git-group__toggle" aria-expanded={!collapsed[g.key]} onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}>
                            <span className={`git-group__caret${collapsed[g.key] ? " is-closed" : ""}`} aria-hidden />
                            {g.label}
                          </button>
                          {g.action && <button type="button" className="link-btn git-group__action" onClick={g.action.run} disabled={g.action.disabled} title={g.action.title}>{g.action.label}</button>}
                          <span className="git-group__count">{g.list.length}</span>
                        </div>
                        {!collapsed[g.key] && (
                          <ul className="item-list">
                            {g.list.map((i) => {
                      const flags = itemFlags(i, items);
                                      const tone = i.reviewStatus === "REJECTED" ? "rejected" : flags.length ? "attention" : i.reviewStatus === "APPROVED" ? "approved" : "review";
                                      const label = [isLive(i) ? "Live" : STATUS[i.reviewStatus].label, ...flags].join(" · ");
                                      return (
                                        <li key={i.id}>
                                          {renamingId === i.id ? (
                                            // Renamed in place: double-click or F2 starts it, Enter keeps it, Escape drops it.
                                            <div className={`item item--${tone} is-selected`}>
                                              <span className="dot" aria-hidden />
                                              <input
                                                autoFocus
                                                onFocus={(e) => e.currentTarget.select()}
                                                className="item__rename"
                                                aria-label="Artwork name"
                                                defaultValue={i.title}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") e.currentTarget.blur();
                                                  if (e.key === "Escape") { e.currentTarget.value = i.title; e.currentTarget.blur(); }
                                                }}
                                                onBlur={(e) => {
                                                  const name = e.target.value.trim();
                                                  setRenamingId(null);
                                                  if (name && name !== i.title) void renameItem(i.id, name).catch(() => {});
                                                }}
                                              />
                                            </div>
                                          ) : rejectingId === i.id ? (
                                            <div className="item item--rejecting" role="alert">
                                              <span className="item__title">Reject {i.title}?</span>
                                              <button type="button" className="link-btn link-btn--danger" onClick={() => { setRejectingId(null); void rejectItem(i.id).then(() => showFlash(`${i.title} rejected`), () => {}); }}>Reject</button>
                                              <button type="button" className="link-btn" onClick={() => setRejectingId(null)}>Keep</button>
                                            </div>
                                          ) : (
                                            <div className={`item-row${i.id === focused?.id ? " is-selected" : ""}`}>
                                              <button
                                                type="button"
                                                className={`item item--${tone}`}
                                                onClick={() => jumpTo(i.id)}
                                                onDoubleClick={() => setRenamingId(i.id)}
                                                onKeyDown={(e) => { if (e.key === "F2") setRenamingId(i.id); }}
                                                title={`${i.title || "Untitled artwork"}\n${label} · ${originOf(i)} · double-click to rename`}
                                              >
                                                <span className="item__title">{i.title || "Untitled artwork"}</span>
                                                <span className="sr-only">{label}</span>
                                              </button>
                                              {/* Only what needs a look is marked; where an artwork came from is in its tooltip. */}
                                              {flags.length > 0 && <span className="git-mark git-mark--attention" title={flags.join(" · ")} aria-label={flags.join(" · ")}>!</span>}
                                              {/* Approve like staging a change: checked is approved, unchecked goes back to review. */}
                                              {i.reviewStatus !== "REJECTED" && (
                                                <input
                                                  type="checkbox"
                                                  className="approve-box"
                                                  checked={i.reviewStatus === "APPROVED"}
                                                  disabled={i.reviewStatus === "IN_REVIEW" && !!approvalBlocker(i, items)}
                                                  title={isLive(i) ? "Published. Uncheck to take it out of the guide at the next Publish All" : i.reviewStatus === "APPROVED" ? "Approved" : (approvalBlocker(i, items) ?? "Approve")}
                                                  aria-label={`Approve ${i.title || "untitled artwork"}`}
                                                  onChange={(e) => {
                                                    if (e.target.checked) { void approveItem(i.id).catch(() => {}); return; }
                                                    const wasLive = isLive(i);
                                                    void reopenItem(i.id).then(() => { if (wasLive) showFlash(`${i.title || "This artwork"} leaves the guide when you Publish All`); }, () => {});
                                                  }}
                                                />
                                              )}
                                            </div>
                                          )}
                                        </li>
                                      );
                            })}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                  {groupsGit.length === 0 && pending.length === 0 && artworks.length > 0 && (
                    <p className="rail-empty">Everything is published. Find it under Go to works.</p>
                  )}
                  {analysisFailed && !analysing && (
                    <p className="empty">The analysis did not finish. <button type="button" className="link-btn link-btn--strong" onClick={() => startAnalysis().catch(() => {})}>Try again</button></p>
                  )}
        </div>
        {/* The page's actions sit at the foot of the rail: Go to works (what is live, with QR codes) and Publish All.
            The editor reports a failed save into it. */}
        <div className="rail-foot">
          <div className="rail-foot__row">
            <span id="editor-status" className="rail-foot__status" />
            {bar()}
          </div>
        </div>
      </nav>

      <article className="doc" aria-label="Editor">
        {duplicateNotice}
        <WideSuggestions editable flash={showFlash} />
        {/* One artwork at a time: the one picked in the list, as its own document. */}
        {/* Nothing yet: a blank page to write on; the artwork is created with the first keystroke. */}
        {!focused && <DraftArtwork onStart={startFromDraft} />}
        {focused && (
          <ItemBlock
            key={focused.id}
            item={focused}
            fresh={freshId === focused.id}
            active
            flash={showFlash}
            onFocus={() => {}}
            onOpen={jumpTo}
            onDoc={(doc) => setLiveDoc({ itemId: focused.id, doc })}
          />
        )}
        {items.length === 0 && analysing && <p className="doc-file__pending" role="status">STILL is drafting artworks from your files…</p>}
      </article>

      {focused && (
        <aside className="visitor-preview-pane" aria-hidden={!showPreview} inert={!showPreview}>
          {phoneLoaded && focused && <PhonePreview code={exhibition.code} pageId={focused.id} doc={previewDoc} draft={visitorDraft} />}
        </aside>
      )}
      {/* One switch for the phone preview, fixed to the window's top-right corner: the editor's corner while the
          preview is closed, the preview's own corner while it is open. Only its icon changes. */}
      {focused && (
        <button type="button" className="icon-btn preview-toggle" aria-pressed={showPreview}
          aria-label={showPreview ? "Close the preview" : "Preview on a phone"} title={showPreview ? "Close the preview" : "Preview on a phone"}
          onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? <XMarkIcon /> : <DevicePhoneMobileIcon />}
        </button>
      )}
      {dragging && <div className="drop-overlay" aria-hidden><p>Drop files to add them to the exhibition</p></div>}
      {flash && <p className="flash flash--toast" role="status">{flash}</p>}
    </div>
  );
}

/** The blank page of an exhibition with no artwork yet. It holds nothing until the first keystroke. */
function DraftArtwork({ onStart }: { onStart: (doc: JSONContent) => void }) {
  const started = useRef(false);
  const editor = useEditor({
    autofocus: "start",
    content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 } }, { type: "paragraph" }] },
    editorProps: { attributes: { "aria-label": "New artwork", role: "textbox", "aria-multiline": "true" } },
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: ({ node, pos }) => (node.type.name === "heading" && pos === 0 ? "Artwork title" : "Write, or drop files anywhere for STILL to draft artworks") }),
    ],
    onUpdate: ({ editor: ed }) => {
      if (started.current) return;
      started.current = true;
      onStart(ed.getJSON());
    },
  });
  return (
    <div className="still-editor">
      <EditorContent editor={editor} className="input input--lg still-editor__body" />
    </div>
  );
}

/** Where an artwork came from, for its tooltip in the rail. */
const originOf = (item: ContentItem) =>
  item.origin === "AI_SUGGESTION" ? "Suggested by STILL"
    : !item.sourceFileName || item.sourceFileName === "Added in the console" ? "Written in the console"
    : `Drafted from ${item.sourceFileName}`;

/** What needs a person's eye on an item, besides its review status. */
function itemFlags(item: ContentItem, items: ContentItem[]): string[] {
  const rightsOpen = item.assets.filter((a) => rightsIssue(a)).length;
  return [
    item.origin === "AI_SUGGESTION" && "AI suggestion",
    isLowConfidence(item) && "Low confidence",
    duplicateOriginal(item, items) && "Possible duplicate",
    rightsOpen > 0 && `Image rights · ${rightsOpen}`,
  ].filter((f): f is string => !!f);
}

interface ItemBlockProps {
  item: ContentItem;
  /** Just created: the caret goes to its title. */
  fresh?: boolean;
  /** The item being worked on: its formatting bar stays out. */
  active: boolean;
  flash: (msg: string) => void;
  onFocus: () => void;
  onOpen: (itemId: string) => void;
  onDoc: (doc: JSONContent) => void;
}

/** One item in the document: its text in the editor, its review status and decision beside it. */
function ItemBlock({ item, fresh, active, flash, onFocus, onOpen, onDoc }: ItemBlockProps) {
  const { exhibition, items, docVersion, dismissDuplicate } = useWorkspace();
  // Everyone in an institution has the same permissions (SPEC §9.2); a rejected item is final (§10.8).
  const rejected = item.reviewStatus === "REJECTED";
  const [saving, setSaving] = useState(false);
  const original = duplicateOriginal(item, items);
  const blocker = approvalBlocker(item, items);
  const flags = itemFlags(item, items);
  const tone = rejected ? "rejected" : flags.length ? "attention" : item.reviewStatus === "APPROVED" ? "approved" : "review";

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    setSaving(true);
    try { await fn(); if (msg) flash(msg); } catch { /* error banner */ } finally { setSaving(false); }
  };

  return (
    <section id={`item-${item.id}`} className={`doc-item item--${tone}${active ? " is-active" : ""}${rejected ? " is-rejected" : ""}`} aria-label={item.title} onFocus={onFocus}>
      {item.origin === "AI_SUGGESTION" && (
        <div className="notice notice--amber" role="note">
          <p><strong>AI suggestion.</strong> STILL wrote this from your materials. It is not a curator statement or an artist quotation, and visitors must never see it attributed to either.</p>
        </div>
      )}
      {isLowConfidence(item) && (
        <div className="notice notice--amber" role="note">
          <p><strong>Low extraction confidence ({Math.round((item.confidence ?? 0) * 100)}%).</strong> Check it against {item.sourceLocation}.</p>
        </div>
      )}
      {original && !rejected && (
        <div className="notice notice--amber" role="note">
          <p><strong>Possible duplicate</strong> of {no(original)} {original.title} ({original.sourceFileName}). Compare them, then reject one or keep both.</p>
          <div className="notice__actions">
            <button type="button" className="link-btn" onClick={() => onOpen(original.id)}>Go to {no(original)}</button>
            <button type="button" className="link-btn" disabled={saving} onClick={() => act(() => dismissDuplicate(item.id), "Kept both items")}>Keep both</button>
          </div>
        </div>
      )}

      {rejected ? (
        <p className="doc-item__rejected">{item.text}</p>
      ) : (
        <>
          <Suggestions itemId={item.id} editable flash={flash} />
          {/* Not keyed by revision: every autosave makes a new one, and remounting would lose the cursor. */}
          <RichEditor key={`${item.id}:${docVersion}`} itemId={item.id} exhibitionId={exhibition?.id ?? ""} doc={api.getContentDoc(item.id) as JSONContent} editable autoFocus={fresh ? "end" : false} onChange={onDoc} />
          {item.reviewStatus === "IN_REVIEW" && blocker && <p className="caption-sm tone-amber">{blocker}</p>}
        </>
      )}
    </section>
  );
}
