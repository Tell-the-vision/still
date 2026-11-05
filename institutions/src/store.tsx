import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  api, isUnauthorized, type ContentItem, type ContentItemPatch, type Exhibition, type Guide, type MediaAssetPatch, type Me, type NewExhibition, type ProcessingEvent,
  type PublicationCheck, type PublicationDetails, type SignInRequest, type SourceFile, type Workspace,
} from "./api";
import { can, type Action } from "./rules";

// All screens read and write through here; this file only talks to `api`, never to sample data.

// "signed-out": no staff session (or it expired); the app shows /sign-in.
// "password-change": signed in with a temporary password; only /change-password works (SPEC §10.5).
type Status = "loading" | "ready" | "error" | "signed-out" | "password-change";

interface ExhibitionData {
  files: SourceFile[];
  items: ContentItem[];
  events: ProcessingEvent[];
  checks: PublicationCheck[];
  guide: Guide;
}
const EMPTY: ExhibitionData = { files: [], items: [], events: [], checks: [], guide: { sections: [], themes: [], hasUnpublishedChanges: false } };

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
      setCurrentId((id) => id ?? list.find((e) => e.status === "DRAFT")?.id ?? list[0]?.id ?? null);
      setStatus("ready");
    } catch (e) {
      if (isUnauthorized(e)) setStatus("signed-out");
      else { fail(e); setStatus("error"); }
    }
  }, []);
  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  // Drops everything the previous user loaded, so nothing leaks to the next sign-in on this device.
  const resetSession = () => {
    queue.current = [];
    inFlight.current.forEach((c) => c.abort());
    inFlight.current.clear();
    retryable.current.clear();
    setWorkspace(null); setMe(null); setExhibitions([]); setCurrentId(null); setData(EMPTY); setLocalFiles([]);
    setStatus("signed-out");
  };

  // Each part loads on its own: one failing call reports an error without blanking the others.
  const loadExhibitionData = useCallback(async (id: string) => {
    const [files, items, events, checks, guide] = await Promise.allSettled([
      api.listFiles(id), api.listContentItems(id), api.listProcessingEvents(id), api.listPublicationChecks(id), api.getGuide(id),
    ]);
    const value = <T,>(part: PromiseSettledResult<T>, fallback: T) => (part.status === "fulfilled" ? part.value : fallback);
    setData({
      files: value(files, EMPTY.files),
      items: value(items, EMPTY.items),
      events: value(events, EMPTY.events),
      checks: value(checks, EMPTY.checks),
      guide: value(guide, EMPTY.guide),
    });
    const failed = [files, items, events, checks, guide].find((part) => part.status === "rejected");
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

  const exhibition = exhibitions.find((e) => e.id === currentId) ?? null;
  const replaceExhibition = (e: Exhibition) => setExhibitions((list) => list.map((x) => (x.id === e.id ? e : x)));
  // Approved items in the current exhibition, for the guide's section picker.
  const approvedItems = useMemo(() => data.items.filter((i) => !i.removed && i.reviewStatus === "APPROVED"), [data.items]);

  // Entry counts by review status. Removed items are kept for Restore but never counted with the rest.
  const counts = useMemo(() => {
    const sum = (f: (i: ContentItem) => boolean) => data.items.filter(f).reduce((n, i) => n + i.itemCount, 0);
    return {
      total: sum((i) => !i.removed),
      needReview: sum((i) => !i.removed && i.reviewStatus === "IN_REVIEW"),
      approved: sum((i) => !i.removed && i.reviewStatus === "APPROVED"),
      rejected: sum((i) => !i.removed && i.reviewStatus === "REJECTED"),
      removed: sum((i) => i.removed),
    };
  }, [data.items]);

  // Runs an item mutation, swaps in the returned item, then refreshes the publication checks it can change.
  const applyItem = async (itemId: string, fn: () => Promise<ContentItem>) => {
    const item = await fn();
    setData((d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? item : i)) }));
    if (currentId) {
      const checks = await api.listPublicationChecks(currentId);
      setData((d) => ({ ...d, checks }));
    }
  };

  const MAX_PARALLEL_UPLOADS = 2;
  const newRowId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Same as applyItem for mutations that change or add several items (merge, split).
  const applyItems = async (fn: () => Promise<ContentItem[]>) => {
    const changed = await fn();
    setData((d) => {
      const byId = new Map(changed.map((i) => [i.id, i]));
      const kept = d.items.map((i) => byId.get(i.id) ?? i);
      const added = changed.filter((i) => !d.items.some((x) => x.id === i.id));
      // Server renumbers `order`, so re-read the list to keep source order right.
      return { ...d, items: [...kept, ...added] };
    });
    if (currentId) {
      const [items, checks] = await Promise.all([api.listContentItems(currentId), api.listPublicationChecks(currentId)]);
      setData((d) => ({ ...d, items, checks }));
    }
    return changed;
  };

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

  // Wraps a mutation: clears the old error, reports a new one, rethrows so callers can stop.
  const run = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setError(null);
    try { return await fn(); } catch (e) { fail(e); throw e; }
  };

  const actions = {
    selectExhibition: setCurrentId,
    clearError: () => setError(null),
    reportError: fail,
    reloadWorkspace: () => api.getWorkspace().then(setWorkspace).catch(fail),
    /** Errors stay on the form (not the app banner) and are rethrown for it. */
    signIn: async (request: SignInRequest) => {
      await api.signIn(request);
      await loadWorkspace();
    },
    /** Errors stay on the form; afterwards the workspace loads as after a normal sign-in. */
    changePassword: async (currentPassword: string, newPassword: string) => {
      await api.changePassword(currentPassword, newPassword);
      await loadWorkspace();
    },
    signOut: () => run(async () => { await api.signOut(); resetSession(); }),
    updateMe: (patch: Pick<Me, "name">) => run(async () => {
      const user = await api.updateMe(patch);
      setMe(user);
      return user;
    }),

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
    duplicateExhibition: (id: string) => run(async () => {
      const copy = await api.duplicateExhibition(id);
      setExhibitions((list) => [copy, ...list]);
      return copy;
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
    startAnalysis: () => run(async () => {
      if (!currentId) return;
      await api.startAnalysis(currentId);
      await loadExhibitionData(currentId);
    }),

    updateItem: (itemId: string, patch: ContentItemPatch) => run(() => applyItem(itemId, () => api.updateContentItem(itemId, patch))),
    revertBlock: (itemId: string, nodeId: string) => run(() => applyItem(itemId, () => api.revertBlockToSource(itemId, nodeId))),
    approveItem: (itemId: string) => run(() => applyItem(itemId, () => api.approveContentItem(itemId))),
    rejectItem: (itemId: string) => run(() => applyItem(itemId, () => api.rejectContentItem(itemId))),
    reopenItem: (itemId: string) => run(() => applyItem(itemId, () => api.reopenContentItem(itemId))),
    updateAsset: (itemId: string, assetId: string, patch: MediaAssetPatch) => run(() => applyItem(itemId, () => api.updateMediaAsset(itemId, assetId, patch))),
    removeItem: (itemId: string) => run(() => applyItem(itemId, () => api.removeContentItem(itemId))),
    restoreItem: (itemId: string) => run(() => applyItem(itemId, () => api.restoreContentItem(itemId))),
    dismissDuplicate: (itemId: string) => run(() => applyItem(itemId, () => api.dismissDuplicate(itemId))),
    mergeItems: (itemId: string, intoId: string, keep: "this" | "into") => run(() => applyItems(() => api.mergeContentItems(itemId, intoId, keep))),
    splitItem: (itemId: string, at: number) => run(() => applyItems(() => api.splitContentItem(itemId, at))),

    saveGuide: (guide: Pick<Guide, "sections" | "themes">) => run(async () => {
      if (!currentId) return;
      const saved = await api.saveGuide(currentId, guide);
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
    can: (action: Action) => can(me, action), events: data.events, checks: data.checks, guide: data.guide,
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
