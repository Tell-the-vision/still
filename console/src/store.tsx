import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  api, ApiError, isPage, isUnauthorized, type ContentItem, type ContentItemPatch, type Exhibition, type Guide, type GuideSection, type MediaAssetPatch, type Me, type NewExhibition, type ProcessingEvent,
  type PublicationCheck, type PublicationDetails, type SignInRequest, type SourceFile, type VisitorDraft, type Workspace,
} from "./api";

// All screens read and write through here; this file only talks to `api`, never to sample data.

// "signed-out": no staff session (or it expired); the app shows /sign-in.
// "password-change": signed in with a temporary password; only /change-password works (SPEC §10.5).
type Status = "loading" | "ready" | "error" | "signed-out" | "password-change";

// The exhibition last opened on this device, so a reload stays on it (for example right after publishing it).
const LAST_EXHIBITION_KEY = "still.console.exhibition";

interface ExhibitionData {
  files: SourceFile[];
  items: ContentItem[];
  events: ProcessingEvent[];
  checks: PublicationCheck[];
  /** Where the console shows each image the documents place, published or not, by image id (console.preview.get). */
  imageUrls: Record<string, string>;
  /** The draft as the visitor renderer takes it, for the phone preview (console.preview.get). */
  visitor: VisitorDraft | null;
  guide: Guide;
}
const EMPTY: ExhibitionData = { files: [], items: [], events: [], checks: [], imageUrls: {}, visitor: null, guide: { sections: [], hasUnpublishedChanges: false } };

function useWorkspaceState() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [data, setData] = useState<ExhibitionData>(EMPTY);
  const [dataStatus, setDataStatus] = useState<Status>("ready");
  // Rows that are not on the server yet: uploading, or failed (unsupported, too big, interrupted).
  const [localFiles, setLocalFiles] = useState<SourceFile[]>([]);
  // Bumped when an item's document changed outside the editor (a decided suggestion, a revert, a reload after
  // REVISION_MISMATCH), so the editor reopens on it. The editor's own autosaves do not bump it.
  const [docVersion, setDocVersion] = useState(0);
  const retryable = useRef(new Map<string, File>());
  // Upload queue (handoff 4.1): a few files at a time, the rest wait as QUEUED and can be canceled.
  const queue = useRef<{ rowId: string; file: File; exhibitionId: string }[]>([]);
  const inFlight = useRef(new Map<string, AbortController>());

  // A call that finds the session gone (expired, or signed out elsewhere) sends the user back to sign-in.
  const fail = (e: unknown) => {
    if (isUnauthorized(e)) { resetSession(); return; }
    setError(e instanceof Error ? e.message : String(e));
  };

  // Workspace + exhibition list. Runs at start and again after signing in.
  const loadWorkspace = useCallback(async () => {
    setStatus("loading");
    try {
      // With a temporary password every call but me.get answers PASSWORD_CHANGE_REQUIRED, so read me first.
      const user = await api.getMe();
      setMe(user);
      if (user.mustChangePassword) { setStatus("password-change"); return; }
      const [w, list] = await Promise.all([api.getWorkspace(), api.listExhibitions()]);
      setWorkspace(w);
      setExhibitions(list);
      const last = localStorage.getItem(LAST_EXHIBITION_KEY);
      setCurrentId((id) => id ?? list.find((e) => e.id === last)?.id ?? list.find((e) => e.status === "DRAFT")?.id ?? list[0]?.id ?? null);
      setStatus("ready");
    } catch (e) {
      if (isUnauthorized(e)) setStatus("signed-out");
      else { fail(e); setStatus("error"); }
    }
  }, []);
  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);
  useEffect(() => { if (currentId) localStorage.setItem(LAST_EXHIBITION_KEY, currentId); }, [currentId]);

  // Drops everything the previous user loaded, so nothing leaks to the next sign-in on this device.
  const resetSession = () => {
    queue.current = [];
    inFlight.current.forEach((c) => c.abort());
    inFlight.current.clear();
    retryable.current.clear();
    localStorage.removeItem(LAST_EXHIBITION_KEY);
    setWorkspace(null); setMe(null); setExhibitions([]); setCurrentId(null); setData(EMPTY); setLocalFiles([]);
    setStatus("signed-out");
  };

  // Each part loads on its own: one failing call reports an error without blanking the others.
  const loadExhibitionData = useCallback(async (id: string) => {
    const [files, items, events, preview, guide] = await Promise.allSettled([
      api.listFiles(id), api.listContentItems(id), api.listProcessingEvents(id), api.getPreview(id), api.getGuide(id),
    ]);
    const value = <T,>(part: PromiseSettledResult<T>, fallback: T) => (part.status === "fulfilled" ? part.value : fallback);
    setData({
      files: value(files, EMPTY.files),
      items: value(items, EMPTY.items),
      events: value(events, EMPTY.events),
      ...value(preview, { checks: EMPTY.checks, imageUrls: EMPTY.imageUrls, visitor: EMPTY.visitor }),
      guide: value(guide, EMPTY.guide),
    });
    const failed = [files, items, events, preview, guide].find((part) => part.status === "rejected");
    if (failed) throw failed.reason;
  }, []);

  useEffect(() => {
    if (!currentId) { setData(EMPTY); return; }
    setDataStatus("loading");
    loadExhibitionData(currentId)
      .then(() => setDataStatus("ready"))
      .catch((e) => { fail(e); setDataStatus("error"); });
  }, [currentId, loadExhibitionData]);

  // While the analysis has no result, reload on each server event (console.analysis.watch over SSE, SPEC §11.1);
  // if the stream errors, reload every 2 s instead so the review screen still fills in when it is done.
  const analysing = data.events.some((ev) => ev.id === "classification" && ev.status === "IN_PROGRESS");
  useEffect(() => {
    if (!currentId || !analysing) return;
    const reload = () => { loadExhibitionData(currentId).catch(fail); };
    let timer: ReturnType<typeof setInterval> | undefined;
    const input = encodeURIComponent(JSON.stringify({ code: currentId }));
    const source = new EventSource(`/api/trpc/console.analysis.watch?client=console&input=${input}`);
    source.onmessage = reload;
    source.onerror = () => { source.close(); timer ??= setInterval(reload, 2000); };
    return () => { source.close(); clearInterval(timer); };
  }, [currentId, analysing, loadExhibitionData]);

  // The analysis starts by itself, with no button: after each upload, and again when a running analysis ends,
  // so files read meanwhile are picked up. console.analysis.create only takes documents not analysed yet.
  // A failed one is not started again on its own: its files stay unanalysed and would fail again, round after round
  // (a picture or a scan has no text yet; a Worker error would cost a Gemini call each time). Try again is a person's.
  const autoAnalyse = useCallback(async (exhibitionId: string) => {
    try {
      await api.startAnalysis(exhibitionId);
    } catch (e) {
      // Nothing new to analyse, or one is running already: the rest is picked up when that one ends.
      if (e instanceof ApiError && (e.code === "BAD_REQUEST" || e.appCode === "ANALYSIS_IN_PROGRESS")) return;
      fail(e);
      return;
    }
    await loadExhibitionData(exhibitionId).catch(fail);
  }, [loadExhibitionData]);
  const analysisFailed = data.events.some((ev) => ev.id === "classification" && ev.status === "FAILED");
  const wasAnalysing = useRef(false);
  useEffect(() => {
    if (wasAnalysing.current && !analysing && !analysisFailed && currentId) void autoAnalyse(currentId);
    wasAnalysing.current = analysing;
  }, [analysing, analysisFailed, currentId, autoAnalyse]);

  const exhibition = exhibitions.find((e) => e.id === currentId) ?? null;
  const replaceExhibition = (e: Exhibition) => setExhibitions((list) => list.map((x) => (x.id === e.id ? e : x)));
  // Approved items in the current exhibition, for the guide's section picker.
  const approvedItems = useMemo(() => data.items.filter((i) => i.reviewStatus === "APPROVED"), [data.items]);

  // Entry counts by review status. Rejected items are final and are not counted with the rest.
  const counts = useMemo(() => {
    const sum = (f: (i: ContentItem) => boolean) => data.items.filter(f).reduce((n, i) => n + i.itemCount, 0);
    return {
      total: sum((i) => i.reviewStatus !== "REJECTED"),
      needReview: sum((i) => i.reviewStatus === "IN_REVIEW"),
      approved: sum((i) => i.reviewStatus === "APPROVED"),
      rejected: sum((i) => i.reviewStatus === "REJECTED"),
    };
  }, [data.items]);

  const replaceItem = (itemId: string, item: ContentItem) => setData((d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? item : i)) }));
  // Re-reads the publication checks and preview images (console.preview.get).
  const refreshPreview = async () => {
    if (!currentId) return;
    const { checks, imageUrls, visitor } = await api.getPreview(currentId);
    setData((d) => ({ ...d, checks, imageUrls, visitor }));
  };
  // Runs an item mutation, swaps in the returned item, then refreshes the publication checks it can change.
  // `docChanged`: the mutation rewrote the document, so the editor reopens on it.
  const applyItem = async (itemId: string, fn: () => Promise<ContentItem>, docChanged = false) => {
    const item = await fn();
    replaceItem(itemId, item);
    if (docChanged) setDocVersion((n) => n + 1);
    await refreshPreview();
  };

  const MAX_PARALLEL_UPLOADS = 2;
  const newRowId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const localRow = (file: File, id: string, status: SourceFile["status"]): SourceFile => ({
    id, name: file.name, format: file.name.split(".").pop()?.toUpperCase() ?? "FILE", summary: null,
    sizeBytes: file.size, uploadedAt: new Date().toISOString(), status, error: null, progress: 0,
  });
  const patchRow = (rowId: string, patch: Partial<SourceFile>) =>
    setLocalFiles((l) => l.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));

  const pump = () => {
    while (inFlight.current.size < MAX_PARALLEL_UPLOADS && queue.current.length) {
      const job = queue.current.shift()!;
      void start(job);
    }
  };
  const start = async ({ rowId, file, exhibitionId }: { rowId: string; file: File; exhibitionId: string }) => {
    const controller = new AbortController();
    inFlight.current.set(rowId, controller);
    patchRow(rowId, { status: "UPLOADING", progress: 0, error: null });
    try {
      const saved = await api.uploadFile(exhibitionId, file, { signal: controller.signal, onProgress: (progress) => patchRow(rowId, { progress }), onExtracting: () => patchRow(rowId, { status: "PROCESSING" }) });
      retryable.current.delete(rowId);
      setLocalFiles((l) => l.filter((r) => r.id !== rowId));
      setData((d) => ({ ...d, files: [...d.files, saved] }));
      void autoAnalyse(exhibitionId);
    } catch (e) {
      retryable.current.set(rowId, file);
      const canceled = e instanceof DOMException && e.name === "AbortError";
      patchRow(rowId, canceled ? { status: "CANCELED", error: null } : { status: "FAILED", error: e instanceof Error ? e.message : String(e) });
    } finally {
      inFlight.current.delete(rowId);
      pump();
    }
  };
  const enqueue = (rowId: string, file: File) => {
    if (!currentId) return;
    queue.current.push({ rowId, file, exhibitionId: currentId });
    pump();
  };

  // Saves the guide with these sections, then publishes it: what the sections list is exactly what goes live.
  // Publishing confirms the rights statement (the API sends it).
  const publishSections = async (sections: GuideSection[]) => {
    if (!currentId) return;
    if (JSON.stringify(sections) !== JSON.stringify(data.guide.sections)) {
      const guide = await api.saveGuide(currentId, sections);
      setData((d) => ({ ...d, guide }));
    }
    replaceExhibition(await api.publishExhibition(currentId));
    // What was just published is read back: the guide has no unpublished changes now (so Go to works takes the
    // emphasis), and the items carry the sentence ids the publication stored.
    await loadExhibitionData(currentId);
  };

  // Wraps a mutation: clears the old error, reports a new one, rethrows so callers can stop.
  const run = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setError(null);
    try { return await fn(); } catch (e) { fail(e); throw e; }
  };

  const actions = {
    selectExhibition: setCurrentId,
    clearError: () => setError(null),
    reportError: fail,
    /** Re-reads the items and checks after a change the server made to several parts (a decided suggestion); the editor reopens on the new text. */
    reloadExhibitionData: () => (currentId ? loadExhibitionData(currentId).then(() => setDocVersion((n) => n + 1)).catch(fail) : Promise.resolve()),
    /** Re-reads the publication checks, e.g. when Preview or Publish opens. Failures go to the banner. */
    refreshChecks: () => refreshPreview().catch(fail),
    /** Editor autosave: swaps in the returned item (an approved one goes back to review). Errors are rethrown for the editor. */
    saveDoc: async (itemId: string, doc: unknown) => {
      replaceItem(itemId, await api.saveContentDoc(itemId, doc));
      // A picture just placed is not in the preview yet: read it again, so the phone preview shows the picture too.
      const placed = ((doc as { content?: { type: string; attrs?: { imageId?: unknown } }[] }).content ?? [])
        .flatMap((block) => (block.type === "stillImage" && typeof block.attrs?.imageId === "string" ? [block.attrs.imageId] : []));
      if (placed.some((imageId) => !(imageId in data.imageUrls))) void refreshPreview().catch(fail);
    },
    reloadWorkspace: () => api.getWorkspace().then(setWorkspace).catch(fail),
    /** Errors stay on the form (not the app banner) and are rethrown for it. */
    signIn: async (request: SignInRequest) => {
      await api.signIn(request);
      await loadWorkspace();
    },
    /** Errors stay on the form; afterwards the workspace loads as after a normal sign-in. */
    // Reloads the account so the temporary-password screen (mustChangePassword) goes away.
    changePassword: async (currentPassword: string, newPassword: string) => {
      await api.changePassword(currentPassword, newPassword);
      await loadWorkspace();
    },
    signOut: () => run(async () => { await api.signOut(); resetSession(); }),

    /** Errors (code taken, invalid code) stay on the dialog and are rethrown for it. */
    createExhibition: async (input: NewExhibition) => {
      try {
        const e = await api.createExhibition(input);
        setExhibitions((list) => [e, ...list]);
        setCurrentId(e.id);
        return e;
      } catch (e) {
        if (isUnauthorized(e)) fail(e);
        throw e;
      }
    },
    deleteExhibition: (id: string) => run(async () => {
      await api.deleteExhibition(id);
      setExhibitions((list) => list.filter((e) => e.id !== id));
      setCurrentId((current) => (current === id ? null : current));
    }),
    updateExhibition: (patch: Partial<PublicationDetails>) => run(async () => {
      if (!currentId) return;
      replaceExhibition(await api.updateExhibition(currentId, patch));
    }),
    publishExhibition: () => run(async () => {
      if (!currentId) return;
      replaceExhibition(await api.publishExhibition(currentId));
    }),
    unpublishExhibition: (id: string) => run(async () => replaceExhibition(await api.unpublishExhibition(id))),
    /**
     * Publish All (SPEC §9.4 발행): the guide becomes every approved item and nothing else. Items under review leave it;
     * approved artworks in no section yet join the artworks one. With nothing approved, nothing is left to show and a
     * live guide goes offline instead.
     */
    publishAll: () => run(async () => {
      if (!currentId) return;
      const approved = new Set(data.items.filter((i) => i.reviewStatus === "APPROVED").map((i) => i.id));
      if (approved.size === 0) { replaceExhibition(await api.unpublishExhibition(currentId)); return; }
      let sections = data.guide.sections.map((section) => ({ ...section, contentIds: section.contentIds.filter((id) => approved.has(id)) }));
      const listed = new Set(sections.flatMap((section) => section.contentIds));
      const missing = data.items.filter((i) => isPage(i) && approved.has(i.id) && !listed.has(i.id)).map((i) => i.id);
      if (missing.length) {
        const at = sections.findIndex((section) => section.kind === "ARTWORK_HIGHLIGHTS");
        sections = at >= 0
          ? sections.map((section, n) => (n === at ? { ...section, contentIds: [...section.contentIds, ...missing] } : section))
          : [...sections, { id: `artworks-${Date.now()}`, kind: "ARTWORK_HIGHLIGHTS", title: "Artworks", visible: true, contentIds: missing }];
      }
      await publishSections(sections);
    }),
    /**
     * Takes one live artwork out of the guide at once, to edit it: it goes back to review and the guide is published
     * again with only what was live besides it (approved artworks waiting for Publish All keep waiting). With nothing
     * left live, the guide goes offline.
     */
    unpublishArtwork: (itemId: string) => run(async () => {
      if (!currentId) return;
      const publishedAt = exhibitions.find((e) => e.id === currentId)?.publishedAt;
      const live = (i: ContentItem) => i.reviewStatus === "APPROVED" && !!publishedAt && !!i.approvedAt && i.approvedAt <= publishedAt;
      const staying = new Set(data.items.filter((i) => i.id !== itemId && live(i)).map((i) => i.id));
      replaceItem(itemId, await api.reopenContentItem(itemId));
      if (staying.size === 0) replaceExhibition(await api.unpublishExhibition(currentId));
      else await publishSections(data.guide.sections.map((section) => ({ ...section, contentIds: section.contentIds.filter((id) => staying.has(id)) })));
      await refreshPreview();
    }),

    /** Queues each file on its own: one failure never discards the others (handoff 12). */
    uploadFiles: (files: File[]) => {
      const rows = files.map((f) => ({ file: f, rowId: newRowId() }));
      setLocalFiles((l) => [...l, ...rows.map(({ file, rowId }) => localRow(file, rowId, "QUEUED"))]);
      rows.forEach(({ file, rowId }) => enqueue(rowId, file));
    },
    /** Files refused before upload (unsupported type, too big) still get a row that says why (handoff 9). */
    rejectFiles: (rows: { file: File; reason: string }[]) =>
      setLocalFiles((l) => [...l, ...rows.map(({ file, reason }) => ({ ...localRow(file, newRowId(), "FAILED"), error: reason }))]),
    canRetry: (rowId: string) => retryable.current.has(rowId),
    retryUpload: (rowId: string) => {
      const file = retryable.current.get(rowId);
      if (!file) return;
      patchRow(rowId, { status: "QUEUED", error: null, progress: 0 });
      enqueue(rowId, file);
    },
    cancelUpload: (rowId: string) => {
      // A row the server already has (an upload that never finished) is removed there.
      if (!localFiles.some((r) => r.id === rowId)) { void actions.deleteFile(rowId).catch(() => {}); return; }
      const queued = queue.current.find((j) => j.rowId === rowId);
      if (queued) {
        queue.current = queue.current.filter((j) => j.rowId !== rowId);
        retryable.current.set(rowId, queued.file);
        patchRow(rowId, { status: "CANCELED" });
      } else {
        inFlight.current.get(rowId)?.abort();
      }
    },
    dismissLocalFile: (rowId: string) => {
      if (!localFiles.some((r) => r.id === rowId)) { void actions.deleteFile(rowId).catch(() => {}); return; }
      retryable.current.delete(rowId);
      setLocalFiles((l) => l.filter((r) => r.id !== rowId));
    },
    deleteFile: (fileId: string) => run(async () => {
      if (!currentId) return;
      await api.deleteFile(currentId, fileId);
      setData((d) => ({ ...d, files: d.files.filter((f) => f.id !== fileId) }));
    }),
    downloadFile: (fileId: string) => run(async () => { window.open(await api.getFileDownloadUrl(fileId), "_blank", "noopener"); }),
    /** Analyses files that were read but never analysed (e.g. the tab closed mid-upload). Quiet when there is nothing new. */
    analysePending: () => (currentId ? autoAnalyse(currentId) : Promise.resolve()),
    startAnalysis: () => run(async () => {
      if (!currentId) return;
      await api.startAnalysis(currentId);
      await loadExhibitionData(currentId);
    }),

    // A text patch rewrites the document, so the editor reopens on it.
    updateItem: (itemId: string, patch: ContentItemPatch) => run(() => applyItem(itemId, () => api.updateContentItem(itemId, patch), patch.text !== undefined)),
    revertBlock: (itemId: string, nodeId: string) => run(() => applyItem(itemId, () => api.revertBlockToSource(itemId, nodeId), true)),
    /** Creates a blank artwork and returns it, so the editor can open on it. */
    createArtwork: (doc: unknown) => run(async () => {
      if (!currentId) throw new Error("No exhibition is open.");
      const created = await api.createArtwork(currentId, doc);
      setData((d) => ({ ...d, items: [...d.items, created] }));
      return created;
    }),
    /** An item's name is its document's first heading (SPEC §10.8), so renaming rewrites that heading; the editor reopens on it. */
    renameItem: (itemId: string, name: string) => run(async () => {
      const doc = structuredClone(api.getContentDoc(itemId)) as { type: "doc"; content: { type: string; attrs?: Record<string, unknown>; content?: unknown[] }[] };
      const at = doc.content.findIndex((b) => b.type === "heading");
      const heading = { type: "heading", attrs: { level: 2, ...(at >= 0 ? doc.content[at].attrs : {}) }, content: [{ type: "text", text: name }] };
      if (at >= 0) doc.content[at] = heading;
      else doc.content.unshift(heading);
      await applyItem(itemId, () => api.saveContentDoc(itemId, doc), true);
    }),
    approveItem: (itemId: string) => run(() => applyItem(itemId, () => api.approveContentItem(itemId))),
    // Rejecting also takes the item out of the guide draft on the server (SPEC §10.8), so re-read the guide.
    rejectItem: (itemId: string) => run(async () => {
      await applyItem(itemId, () => api.rejectContentItem(itemId));
      if (currentId) { const guide = await api.getGuide(currentId); setData((d) => ({ ...d, guide })); }
    }),
    reopenItem: (itemId: string) => run(() => applyItem(itemId, () => api.reopenContentItem(itemId))),
    updateAsset: (itemId: string, assetId: string, patch: MediaAssetPatch) => run(() => applyItem(itemId, () => api.updateMediaAsset(itemId, assetId, patch))),
    dismissDuplicate: (itemId: string) => run(() => applyItem(itemId, () => api.dismissDuplicate(itemId))),

    saveGuide: (sections: GuideSection[]) => run(async () => {
      if (!currentId) return;
      const saved = await api.saveGuide(currentId, sections);
      setData((d) => ({ ...d, guide: saved }));
    }),
    publishGuide: () => run(async () => {
      if (!currentId) return;
      const saved = await api.publishGuide(currentId);
      setData((d) => ({ ...d, guide: saved }));
    }),
  };

  return {
    status, dataStatus, error, workspace, me, exhibitions, exhibition, counts,
    files: [...data.files, ...localFiles], items: data.items, approvedItems,
    events: data.events, analysing, checks: data.checks, imageUrls: data.imageUrls, visitorDraft: data.visitor, guide: data.guide, docVersion,
    ...actions,
  };
}

type WorkspaceState = ReturnType<typeof useWorkspaceState>;
const Ctx = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useWorkspaceState();
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace outside WorkspaceProvider");
  return v;
}
