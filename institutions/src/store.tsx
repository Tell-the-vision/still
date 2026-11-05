import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  api, type ContentItem, type ContentItemPatch, type Exhibition, type Guide, type MediaAssetPatch, type Me, type ProcessingEvent,
  type PublicationCheck, type PublicationDetails, type SourceFile, type Workspace,
} from "./api";
import { can, type Action } from "./rules";

// All screens read and write through here; this file only talks to `api`, never to sample data.

type Status = "loading" | "ready" | "error";

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

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  // Workspace + exhibition list
  useEffect(() => {
    Promise.all([api.getWorkspace(), api.listExhibitions(), api.getMe()])
      .then(([w, list, user]) => {
        setWorkspace(w);
        setMe(user);
        setExhibitions(list);
        setCurrentId((id) => id ?? list.find((e) => e.status === "DRAFT")?.id ?? list[0]?.id ?? null);
        setStatus("ready");
      })
      .catch((e) => { fail(e); setStatus("error"); });
  }, []);

  const loadExhibitionData = useCallback(async (id: string) => {
    const [files, items, events, checks, guide] = await Promise.all([
      api.listFiles(id), api.listContentItems(id), api.listProcessingEvents(id), api.listPublicationChecks(id), api.getGuide(id),
    ]);
    setData({ files, items, events, checks, guide });
  }, []);

  useEffect(() => {
    if (!currentId) { setData(EMPTY); return; }
    setDataStatus("loading");
    loadExhibitionData(currentId)
      .then(() => setDataStatus("ready"))
      .catch((e) => { fail(e); setDataStatus("error"); });
  }, [currentId, loadExhibitionData]);

  const exhibition = exhibitions.find((e) => e.id === currentId) ?? null;
  const replaceExhibition = (e: Exhibition) => setExhibitions((list) => list.map((x) => (x.id === e.id ? e : x)));

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

  const localRow = (file: File, id: string): SourceFile => ({
    id, name: file.name, format: file.name.split(".").pop()?.toUpperCase() ?? "FILE", summary: null,
    sizeBytes: file.size, uploadedAt: new Date().toISOString(), status: "UPLOADING", error: null,
  });
  const uploadOne = async (file: File, rowId: string) => {
    if (!currentId) return;
    setLocalFiles((l) => [...l.filter((r) => r.id !== rowId), localRow(file, rowId)]);
    try {
      const saved = await api.uploadFile(currentId, file);
      retryable.current.delete(rowId);
      setLocalFiles((l) => l.filter((r) => r.id !== rowId));
      setData((d) => ({ ...d, files: [...d.files, saved] }));
    } catch (e) {
      retryable.current.set(rowId, file);
      const error = e instanceof Error ? e.message : String(e);
      setLocalFiles((l) => l.map((r) => (r.id === rowId ? { ...r, status: "FAILED", error } : r)));
    }
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
    signOut: () => run(() => api.signOut()),
    updateMe: (patch: Pick<Me, "name">) => run(async () => {
      const user = await api.updateMe(patch);
      setMe(user);
      return user;
    }),

    createExhibition: () => run(async () => {
      const e = await api.createExhibition();
      setExhibitions((list) => [e, ...list]);
      setCurrentId(e.id);
      return e;
    }),
    updateExhibition: (patch: Partial<PublicationDetails>) => run(async () => {
      if (!currentId) return;
      replaceExhibition(await api.updateExhibition(currentId, patch));
    }),
    publishExhibition: () => run(async () => {
      if (!currentId) return;
      replaceExhibition(await api.publishExhibition(currentId));
    }),

    /** Uploads each file on its own: one failure never discards the others (handoff 12). */
    uploadFiles: (files: File[]) => Promise.all(files.map((f) => uploadOne(f, `local-${Date.now()}-${Math.random().toString(36).slice(2)}`))),
    /** Files refused before upload (unsupported type, too big) still get a row that says why (handoff 9). */
    rejectFiles: (rows: { file: File; reason: string }[]) =>
      setLocalFiles((l) => [...l, ...rows.map(({ file, reason }) => ({ ...localRow(file, `local-${Date.now()}-${Math.random().toString(36).slice(2)}`), status: "FAILED" as const, error: reason }))]),
    canRetry: (rowId: string) => retryable.current.has(rowId),
    retryUpload: (rowId: string) => {
      const file = retryable.current.get(rowId);
      return file ? uploadOne(file, rowId) : Promise.resolve();
    },
    dismissLocalFile: (rowId: string) => {
      retryable.current.delete(rowId);
      setLocalFiles((l) => l.filter((r) => r.id !== rowId));
    },
    deleteFile: (fileId: string) => run(async () => {
      if (!currentId) return;
      await api.deleteFile(currentId, fileId);
      setData((d) => ({ ...d, files: d.files.filter((f) => f.id !== fileId) }));
    }),
    startAnalysis: () => run(async () => {
      if (!currentId) return;
      await api.startAnalysis(currentId);
      await loadExhibitionData(currentId);
    }),

    updateItem: (itemId: string, patch: ContentItemPatch) => run(() => applyItem(itemId, () => api.updateContentItem(itemId, patch))),
    approveItem: (itemId: string) => run(() => applyItem(itemId, () => api.approveContentItem(itemId))),
    rejectItem: (itemId: string) => run(() => applyItem(itemId, () => api.rejectContentItem(itemId))),
    reopenItem: (itemId: string) => run(() => applyItem(itemId, () => api.reopenContentItem(itemId))),
    updateAsset: (itemId: string, assetId: string, patch: MediaAssetPatch) => run(() => applyItem(itemId, () => api.updateMediaAsset(itemId, assetId, patch))),
    removeItem: (itemId: string) => run(() => applyItem(itemId, () => api.removeContentItem(itemId))),
    restoreItem: (itemId: string) => run(() => applyItem(itemId, () => api.restoreContentItem(itemId))),
    dismissDuplicate: (itemId: string) => run(() => applyItem(itemId, () => api.dismissDuplicate(itemId))),

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
    files: [...data.files, ...localFiles], items: data.items,
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
