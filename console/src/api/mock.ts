// In-memory ConsoleApi for working without a backend. State resets on reload.
import { approvalBlocker, blockingAssets } from "../rules";
import { ApiError } from "./errors";
import type { ConsoleApi, ContentItem, Exhibition, Guide, PublicationCheck, ReviewStatus } from "./types";
import { emptySeed, sampleSeed, type Seed } from "./seed";

const wait = <T,>(value: T, ms = 120): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(value)), ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const now = () => new Date().toISOString();
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function createMockApi(kind: "sample" | "empty"): ConsoleApi {
  const db: Seed = kind === "empty" ? emptySeed() : sampleSeed();
  // Starts signed in so every screen opens directly; ?signedOut (or Sign out) shows the sign-in screen.
  let signedIn = !new URLSearchParams(window.location.search).has("signedOut");

  const exhibition = (id: string) => {
    const e = db.exhibitions.find((x) => x.id === id);
    if (!e) throw new Error(`Exhibition ${id} not found`);
    return e;
  };
  const findItem = (itemId: string): ContentItem => {
    for (const list of Object.values(db.items)) {
      const hit = list.find((i) => i.id === itemId);
      if (hit) return hit;
    }
    throw new Error(`Content item ${itemId} not found`);
  };
  const siblings = (itemId: string) => Object.values(db.items).find((list) => list.some((i) => i.id === itemId)) ?? [];
  const touch = (id: string) => { exhibition(id).updatedAt = now(); };
  const edited = (item: ContentItem) => { item.updatedBy = db.me.name; item.updatedAt = now(); return wait(item); };
  const setStatus = (itemId: string, status: ReviewStatus) => { findItem(itemId).reviewStatus = status; return edited(findItem(itemId)); };
  // Uploads whose name contains "fail" fail once, so the retry path can be tried in the mock.
  const failedOnce = new Set<string>();

  const derivedChecks = (id: string): PublicationCheck[] => {
    const items = (db.items[id] ?? []).filter((i) => i.reviewStatus !== "REJECTED");
    const total = items.reduce((n, i) => n + i.itemCount, 0);
    const approved = items.filter((i) => i.reviewStatus === "APPROVED").reduce((n, i) => n + i.itemCount, 0);
    const assets = items.filter((i) => i.reviewStatus === "APPROVED").flatMap((i) => i.assets);
    const blocked = blockingAssets(items).length;
    return (db.checks[id] ?? []).map((c) =>
      // Approval is not "all items approved": in-review items are simply left out of the guide.
      c.title === "Content approval" ? { ...c, value: `${approved} / ${total}`, ok: approved > 0 }
      : c.title === "Image permissions" ? { ...c, value: assets.length ? `${assets.length - blocked} / ${assets.length}` : "No images", ok: blocked === 0 }
      : c,
    );
  };

  const impl: ConsoleApi = {
    getWorkspace: () => wait(db.workspace),

    async signIn({ institutionId, email, password }) {
      // Mock credentials: this workspace's institution ID, one of its accounts, any password except "wrong".
      const known = institutionId.trim().toUpperCase() === db.workspace.institutionId
        && db.accounts.includes(email.trim().toLowerCase())
        && password !== "wrong";
      // One message for every mismatch, so the form never reveals which IDs or emails exist.
      if (!known) { await wait(undefined, 400); throw new ApiError("Institution ID, email or password is incorrect.", "UNAUTHORIZED"); }
      signedIn = true;
      return wait(db.me, 400);
    },
    getMe: () => wait(db.me),
    async changePassword(currentPassword, newPassword) {
      // Mock rule: any current password except "wrong"; the new one needs 10+ characters (SPEC §10.5).
      if (currentPassword === "wrong") throw new ApiError("The current password is incorrect.", "BAD_REQUEST");
      if (newPassword.length < 10) throw new ApiError("Use at least 10 characters for the new password.", "BAD_REQUEST");
      db.password = newPassword;
      return wait(undefined, 300);
    },
    async signOut() { signedIn = false; return wait(undefined, 300); },
    listVenues: () => wait(db.venues),
    async createVenue({ name, city }) {
      const code = slug(name) || uid().slice(0, 8);
      if (db.venues.some((x) => x.code === code)) throw new Error(`A venue called "${name}" already exists`);
      const venue = { id: uid(), code, name, city };
      db.venues.push(venue);
      return wait(venue);
    },

    listExhibitions: () => wait(db.exhibitions),
    async createExhibition({ title, code }) {
      if (db.exhibitions.some((x) => x.code === code)) throw new ApiError("Exhibition code is already taken", "CONFLICT", "CODE_TAKEN");
      const e: Exhibition = {
        id: uid(), code, title, subtitle: null,
        venueName: db.workspace.institutionName, venueId: null, startDate: null, endDate: null, status: "DRAFT", updatedAt: now(),
      };
      db.exhibitions.unshift(e);
      db.guides[e.id] = { sections: [], hasUnpublishedChanges: false };
      return wait(e);
    },
    async deleteExhibition(id) {
      if (exhibition(id).status === "PUBLISHED") throw new ApiError("A published exhibition cannot be deleted", "CONFLICT", "EXHIBITION_PUBLISHED");
      db.exhibitions = db.exhibitions.filter((x) => x.id !== id);
      delete db.guides[id];
      return wait(undefined);
    },
    async updateExhibition(id, patch) {
      Object.assign(exhibition(id), patch, { updatedAt: now() });
      return wait(exhibition(id));
    },
    async unpublishExhibition(id) {
      Object.assign(exhibition(id), { status: "DRAFT", updatedAt: now() });
      return wait(exhibition(id), 300);
    },
    async publishExhibition(id) {
      const items = db.items[id] ?? [];
      if (!items.some((i) => i.reviewStatus === "APPROVED")) throw new Error("Approve at least one content item before publishing.");
      if (blockingAssets(items).length) throw new Error("Some images in approved content have no confirmed rights.");
      Object.assign(exhibition(id), { status: "PUBLISHED", updatedAt: now() });
      return wait(exhibition(id), 400);
    },

    listFiles: (id) => wait(db.files[id] ?? []),
    async uploadFile(id, file, options) {
      // Simulated progress in 5 steps; the signal cancels between steps.
      for (const pct of [15, 35, 60, 85]) {
        await wait(null, 180);
        if (options?.signal?.aborted) throw new DOMException("Upload canceled", "AbortError");
        options?.onProgress?.(pct);
        if (pct === 60 && /fail/i.test(file.name) && !failedOnce.has(file.name)) {
          failedOnce.add(file.name);
          throw new Error("Upload interrupted");
        }
      }
      options?.onProgress?.(100);
      const f = {
        id: uid(), name: file.name, format: file.name.split(".").pop()?.toUpperCase() ?? "FILE", summary: null,
        sizeBytes: file.size, uploadedAt: now(), status: "UPLOADED" as const, error: null,
      };
      (db.files[id] ??= []).push(f);
      touch(id);
      return wait(f, 100);
    },
    async deleteFile(id, fileId) {
      db.files[id] = (db.files[id] ?? []).filter((f) => f.id !== fileId);
      return wait(undefined);
    },
    async getFileDownloadUrl(fileId) {
      const file = Object.values(db.files).flat().find((f) => f.id === fileId);
      return wait(URL.createObjectURL(new Blob([`Mock original of ${file?.name ?? fileId}`], { type: "text/plain" })));
    },
    async startAnalysis(id) {
      for (const f of db.files[id] ?? []) if (f.status === "UPLOADED") f.status = "PROCESSING";
      (db.events[id] ??= []).push({ id: uid(), at: now(), title: "Analysis requested", detail: `${db.files[id]?.length ?? 0} files`, status: "IN_PROGRESS" });
      return wait(undefined, 300);
    },
    listProcessingEvents: (id) => wait(db.events[id] ?? []),

    listContentItems: (id) => wait([...(db.items[id] ?? [])].sort((a, b) => a.order - b.order)),
    listImages: () => wait([]),
    getContentDoc: (itemId) => ({
      type: "doc",
      content: findItem(itemId).text.split(/\n\s*\n/).map((t) => ({ type: "paragraph", content: t ? [{ type: "text", text: t }] : [] })),
    }),
    async saveContentDoc(itemId, doc) {
      const text = ((doc as { content?: { type: string; content?: { text?: string }[] }[] }).content ?? [])
        .filter((b) => b.type === "paragraph").map((b) => (b.content ?? []).map((t) => t.text ?? "").join("")).join("\n\n");
      return this.updateContentItem(itemId, { text });
    },
    async updateContentItem(itemId, patch) {
      const item = findItem(itemId);
      if (item.reviewStatus === "REJECTED") throw new Error("Rejected items cannot be edited.");
      // SPEC §10.8: editing an approved item sends it back to review.
      return edited(Object.assign(item, patch, item.reviewStatus === "APPROVED" ? { reviewStatus: "IN_REVIEW" } : {}));
    },
    listBlockSources: async () => [],
    revertBlockToSource: async () => { throw new Error("Not available in the sample data."); },
    async approveContentItem(itemId) {
      const blocker = approvalBlocker(findItem(itemId), siblings(itemId));
      if (blocker) throw new Error(blocker);
      return setStatus(itemId, "APPROVED");
    },
    async rejectContentItem(itemId) {
      // SPEC §10.8: REJECTED is final and the item leaves every guide section in the same step.
      for (const guide of Object.values(db.guides)) for (const s of guide.sections) s.contentIds = s.contentIds.filter((x) => x !== itemId);
      return setStatus(itemId, "REJECTED");
    },
    async reopenContentItem(itemId) {
      if (findItem(itemId).reviewStatus !== "APPROVED") throw new Error("Only approved items can go back to review.");
      return setStatus(itemId, "IN_REVIEW");
    },
    async dismissDuplicate(itemId) {
      return edited(Object.assign(findItem(itemId), { duplicateOf: null }));
    },
    listSuggestions: () => wait([]),
    decideSuggestion: () => wait(undefined),
    async updateMediaAsset(itemId, assetId, patch) {
      const a = findItem(itemId).assets.find((x) => x.id === assetId);
      if (!a) throw new Error("Image not found");
      Object.assign(a, patch);
      return edited(findItem(itemId));
    },

    listPublicationChecks: (id) => wait(derivedChecks(id)),

    getGuide: (id) => wait<Guide>(db.guides[id] ?? { sections: [], hasUnpublishedChanges: false }),
    async saveGuide(id, sections) {
      db.guides[id] = { sections, hasUnpublishedChanges: true };
      return wait(db.guides[id]);
    },
    async publishGuide(id) {
      db.guides[id] = { sections: db.guides[id]?.sections ?? [], hasUnpublishedChanges: false };
      return wait(db.guides[id], 300);
    },
  };

  // Same as the server: every call needs a staff session except signIn (Figma 10).
  return new Proxy(impl, {
    get(target, key: keyof ConsoleApi) {
      const fn = target[key] as (...args: unknown[]) => Promise<unknown>;
      if (key === "signIn") return fn;
      return (...args: unknown[]) => (signedIn ? fn(...args) : Promise.reject(new ApiError("Sign in to continue.", "UNAUTHORIZED")));
    },
  });
}
