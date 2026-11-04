import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api, type ContentItem, type ContentItemPatch, type Exhibition, type Guide, type Me, type ProcessingEvent,
  type PublicationCheck, type PublicationDetails, type SourceFile, type Workspace,
} from "./api";

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
  const [uploading, setUploading] = useState<SourceFile[]>([]);

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

  const counts = useMemo(() => {
    const total = data.items.reduce((n, i) => n + i.itemCount, 0);
    const needReview = data.items.reduce((n, i) => n + i.pendingCount, 0);
    return { total, needReview, approved: total - needReview };
  }, [data.items]);

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

    uploadFiles: (files: File[]) => run(async () => {
      if (!currentId) return;
      const pending = files.map((f, i): SourceFile => ({
        id: `pending-${Date.now()}-${i}`, name: f.name, format: f.name.split(".").pop()?.toUpperCase() ?? "FILE",
        summary: null, sizeBytes: f.size, uploadedAt: new Date().toISOString(), status: "UPLOADING",
      }));
      setUploading((u) => [...u, ...pending]);
      try {
        const saved = await Promise.all(files.map((f) => api.uploadFile(currentId, f)));
        setData((d) => ({ ...d, files: [...d.files, ...saved] }));
      } finally {
        setUploading((u) => u.filter((p) => !pending.includes(p)));
      }
    }),
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

    updateItem: (itemId: string, patch: ContentItemPatch) => run(async () => {
      const item = await api.updateContentItem(itemId, patch);
      setData((d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? item : i)) }));
    }),
    approveItem: (itemId: string) => run(async () => {
      const item = await api.approveContentItem(itemId);
      setData((d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? item : i)) }));
      if (currentId) {
        const checks = await api.listPublicationChecks(currentId);
        setData((d) => ({ ...d, checks }));
      }
    }),

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
    files: [...data.files, ...uploading], items: data.items, events: data.events, checks: data.checks, guide: data.guide,
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
