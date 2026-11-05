// In-memory InstitutionsApi for working without a backend. State resets on reload.
import { approvalBlocker, blockingAssets, can, NO_PERMISSION, type Action } from "../rules";
import { ApiError } from "./errors";
import type { InstitutionsApi, ContentItem, Exhibition, Guide, PublicationCheck, ReviewStatus } from "./types";
import { emptySeed, sampleSeed, type Seed } from "./seed";

const wait = <T,>(value: T, ms = 120): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(value)), ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const now = () => new Date().toISOString();

export function createMockApi(kind: "sample" | "empty"): InstitutionsApi {
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
  const active = (id: string) => (db.items[id] ?? []).filter((i) => !i.removed);
  const touch = (id: string) => { exhibition(id).updatedAt = now(); };
  // Same checks the server must make (handoff 3: hidden buttons are not access control).
  const allow = (action: Action) => { if (!can(db.me, action)) throw new Error(NO_PERMISSION[action]); };
  const edited = (item: ContentItem) => { item.updatedBy = db.me.name; item.updatedAt = now(); return wait(item); };
  const setStatus = (itemId: string, status: ReviewStatus) => { allow("review"); findItem(itemId).reviewStatus = status; return edited(findItem(itemId)); };
  // Uploads whose name contains "fail" fail once, so the retry path can be tried in the mock.
  const failedOnce = new Set<string>();
  const log = (text: string) => db.activity.unshift({ id: uid(), at: now(), actor: db.me.name, text });

  const derivedChecks = (id: string): PublicationCheck[] => {
    const items = active(id);
    const total = items.reduce((n, i) => n + i.itemCount, 0);
    const approved = items.filter((i) => i.reviewStatus === "APPROVED").reduce((n, i) => n + i.itemCount, 0);
    const assets = items.filter((i) => i.reviewStatus === "APPROVED").flatMap((i) => i.assets).filter((a) => !a.excluded);
    const blocked = blockingAssets(items).length;
    return (db.checks[id] ?? []).map((c) =>
      // Approval is not "all items approved": in-review and rejected items are simply left out of the guide.
      c.title === "Content approval" ? { ...c, value: `${approved} / ${total}`, ok: approved > 0 }
      : c.title === "Image permissions" ? { ...c, value: assets.length ? `${assets.length - blocked} / ${assets.length}` : "No images", ok: blocked === 0 }
      : c,
    );
  };

  const impl: InstitutionsApi = {
    getWorkspace: () => wait(db.workspace),

    async getWorkspaceSummary() {
      const attention = db.exhibitions
        .map((e) => ({ exhibitionId: e.id, title: e.title, pendingCount: active(e.id).filter((i) => i.reviewStatus === "IN_REVIEW").reduce((n, i) => n + i.itemCount, 0) }))
        .filter((a) => a.pendingCount > 0);
      return wait({ attention, activity: [...db.activity].sort((a, b) => b.at.localeCompare(a.at)), memberCount: db.members.length });
    },

    async signIn({ institutionId, email, password }) {
      // Mock credentials: this workspace's institution ID, any member email, any password except "wrong".
      const known = institutionId.trim().toUpperCase() === db.workspace.institutionId
        && db.members.some((m) => m.email.toLowerCase() === email.trim().toLowerCase())
        && password !== "wrong";
      // One message for every mismatch, so the form never reveals which IDs or emails exist.
      if (!known) { await wait(undefined, 400); throw new ApiError("Institution ID, email or password is incorrect.", "UNAUTHORIZED"); }
      signedIn = true;
      return wait(db.me, 400);
    },
    getMe: () => wait(db.me),
    async updateMe(patch) {
      db.me = { ...db.me, ...patch };
      db.members = db.members.map((m) => (m.id === db.me.id ? { ...m, name: db.me.name } : m));
      return wait(db.me, 300);
    },
    getNotificationPrefs: () => wait(db.notifications),
    async updateNotificationPrefs(patch) {
      db.notifications = { ...db.notifications, ...patch };
      return wait(db.notifications);
    },
    async signOut() { signedIn = false; return wait(undefined, 300); },
    async changePassword(currentPassword, newPassword) {
      // Mock: any current password except "wrong" is accepted.
      if (currentPassword === "wrong") { await wait(undefined, 300); throw new ApiError("The current password is incorrect.", "BAD_REQUEST"); }
      if (newPassword.length < 12) throw new ApiError("The new password must be at least 12 characters.", "BAD_REQUEST");
      db.me = { ...db.me, mustChangePassword: false };
      return wait(undefined, 300);
    },
    getWorkspaceSettings: () => wait(db.settings),
    async updateWorkspaceSettings(patch) {
      allow("manageWorkspace");
      db.settings = { ...db.settings, ...patch, publishing: { ...db.settings.publishing, ...patch.publishing } };
      db.workspace.institutionName = db.settings.institutionName;
      return wait(db.settings, 300);
    },
    listVenues: () => wait(db.venues),
    async createVenue(v) {
      allow("manageWorkspace");
      if (db.venues.some((x) => x.code === v.code)) throw new Error(`Venue code "${v.code}" is already used`);
      const venue = { ...v, id: uid() };
      db.venues.push(venue);
      return wait(venue);
    },
    listMembers: () => wait(db.members),
    async inviteMember(email, role) {
      allow("manageWorkspace");
      if (db.members.some((m) => m.email.toLowerCase() === email.toLowerCase())) throw new Error(`${email} is already in this workspace`);
      const m = { id: uid(), name: null, email, role, canPublish: role === "INSTITUTION_ADMIN", status: "INVITED" as const };
      db.members.push(m);
      log(`Invited ${email}`);
      return wait(m, 300);
    },
    async updateMember(memberId, patch) {
      allow("manageWorkspace");
      const m = db.members.find((x) => x.id === memberId);
      if (!m) throw new Error("Member not found");
      Object.assign(m, patch);
      // Admins always publish; reviewers and read-only members never do.
      if (m.role === "INSTITUTION_ADMIN") m.canPublish = true;
      if (m.role === "REVIEWER" || m.role === "READ_ONLY") m.canPublish = false;
      return wait(m);
    },
    async removeMember(memberId) {
      allow("manageWorkspace");
      if (memberId === db.me.id) throw new Error("You cannot remove yourself");
      db.members = db.members.filter((m) => m.id !== memberId);
      return wait(undefined);
    },
    sendSupportRequest: () => wait({ ticketId: `T-${Math.floor(1000 + Math.random() * 9000)}` }, 500),

    listExhibitions: () => wait(db.exhibitions),
    async createExhibition() {
      allow("edit");
      const e: Exhibition = {
        id: uid(), code: `untitled-${db.exhibitions.length + 1}`, title: "Untitled Exhibition", subtitle: null,
        venueName: db.workspace.institutionName, startDate: null, endDate: null, status: "DRAFT", updatedAt: now(),
      };
      db.exhibitions.unshift(e);
      db.guides[e.id] = { sections: [], themes: [], hasUnpublishedChanges: false };
      return wait(e);
    },
    async updateExhibition(id, patch) {
      allow("edit");
      Object.assign(exhibition(id), patch, { updatedAt: now() });
      return wait(exhibition(id));
    },
    async unpublishExhibition(id) {
      allow("publish");
      Object.assign(exhibition(id), { status: "DRAFT", updatedAt: now() });
      log(`Unpublished ${exhibition(id).title}`);
      return wait(exhibition(id), 300);
    },
    async duplicateExhibition(id) {
      allow("edit");
      const src = exhibition(id);
      const copy: Exhibition = { ...src, id: uid(), code: `${src.code}-copy-${db.exhibitions.length + 1}`, title: `${src.title} (copy)`, status: "DRAFT", updatedAt: now() };
      db.exhibitions.unshift(copy);
      const guide = db.guides[id];
      // Same structure, no content: the copy's items come from its own uploads.
      db.guides[copy.id] = { sections: (guide?.sections ?? []).map((s) => ({ ...s, id: uid(), itemIds: [] })), themes: structuredClone(guide?.themes ?? []), hasUnpublishedChanges: true };
      log(`Duplicated ${src.title} as a new draft`);
      return wait(copy, 300);
    },
    async publishExhibition(id) {
      allow("publish");
      const items = active(id);
      if (!items.some((i) => i.reviewStatus === "APPROVED")) throw new Error("Approve at least one content item before publishing.");
      if (blockingAssets(items).length) throw new Error("Some images in approved content have no confirmed rights.");
      Object.assign(exhibition(id), { status: "PUBLISHED", updatedAt: now() });
      log(`Published ${exhibition(id).title}`);
      return wait(exhibition(id), 400);
    },

    listFiles: (id) => wait(db.files[id] ?? []),
    async uploadFile(id, file, options) {
      allow("edit");
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
      log(`Uploaded ${file.name} to ${exhibition(id).title}`);
      return wait(f, 100);
    },
    async deleteFile(id, fileId) {
      allow("edit");
      db.files[id] = (db.files[id] ?? []).filter((f) => f.id !== fileId);
      return wait(undefined);
    },
    async startAnalysis(id) {
      allow("edit");
      for (const f of db.files[id] ?? []) if (f.status === "UPLOADED") f.status = "PROCESSING";
      (db.events[id] ??= []).push({ id: uid(), at: now(), title: "Analysis requested", detail: `${db.files[id]?.length ?? 0} files`, status: "IN_PROGRESS" });
      return wait(undefined, 300);
    },
    listProcessingEvents: (id) => wait(db.events[id] ?? []),

    listContentItems: (id) => wait([...(db.items[id] ?? [])].sort((a, b) => a.order - b.order)),
    async updateContentItem(itemId, patch) {
      allow("edit");
      return edited(Object.assign(findItem(itemId), patch));
    },
    async approveContentItem(itemId) {
      const blocker = approvalBlocker(findItem(itemId), siblings(itemId));
      if (blocker) throw new Error(blocker);
      return setStatus(itemId, "APPROVED");
    },
    rejectContentItem: (itemId) => setStatus(itemId, "REJECTED"),
    reopenContentItem: (itemId) => setStatus(itemId, "IN_REVIEW"),
    async removeContentItem(itemId) {
      allow("edit");
      return edited(Object.assign(findItem(itemId), { removed: true }));
    },
    async restoreContentItem(itemId) {
      allow("edit");
      return edited(Object.assign(findItem(itemId), { removed: false }));
    },
    async dismissDuplicate(itemId) {
      allow("edit");
      return edited(Object.assign(findItem(itemId), { duplicateOf: null }));
    },
    async mergeContentItems(itemId, intoId, keep) {
      allow("edit");
      const dup = findItem(itemId);
      const into = findItem(intoId);
      if (keep === "this") into.text = dup.text;
      into.sourceLocation = `${into.sourceLocation} · also in ${dup.sourceFileName}`;
      into.assets = [...into.assets, ...dup.assets];
      Object.assign(dup, { removed: true, duplicateOf: null, note: `Merged into ${into.title}` });
      into.updatedBy = dup.updatedBy = db.me.name;
      into.updatedAt = dup.updatedAt = now();
      return wait([into, dup]);
    },
    async splitContentItem(itemId, at) {
      allow("edit");
      const item = findItem(itemId);
      const head = item.text.slice(0, at).trim();
      const tail = item.text.slice(at).trim();
      if (!head || !tail) throw new Error("Put the cursor where the second item should start.");
      const list = siblings(itemId);
      const part: ContentItem = {
        ...structuredClone(item), id: uid(), order: item.order + 0.5, title: `${item.title} (2)`, heading: `${item.heading} (2)`,
        text: tail, originalText: tail, itemCount: 1, reviewStatus: "IN_REVIEW", duplicateOf: null, assets: [], updatedBy: db.me.name, updatedAt: now(),
      };
      Object.assign(item, { text: head, itemCount: Math.max(1, item.itemCount - 1), reviewStatus: "IN_REVIEW", updatedBy: db.me.name, updatedAt: now() });
      list.push(part);
      list.sort((a, b) => a.order - b.order).forEach((x, i) => { x.order = i + 1; });
      return wait([item, part]);
    },
    async updateMediaAsset(itemId, assetId, patch) {
      if (!can(db.me, "edit") && !can(db.me, "review")) throw new Error(NO_PERMISSION.edit);
      const a = findItem(itemId).assets.find((x) => x.id === assetId);
      if (!a) throw new Error("Image not found");
      Object.assign(a, patch, { reviewedBy: db.me.name, reviewedAt: now() });
      return edited(findItem(itemId));
    },

    listPublicationChecks: (id) => wait(derivedChecks(id)),

    getGuide: (id) => wait<Guide>(db.guides[id] ?? { sections: [], themes: [], hasUnpublishedChanges: false }),
    async saveGuide(id, guide) {
      allow("edit");
      db.guides[id] = { ...guide, hasUnpublishedChanges: true };
      return wait(db.guides[id]);
    },
    async publishGuide(id) {
      allow("publish");
      db.guides[id] = { ...(db.guides[id] ?? { sections: [], themes: [] }), hasUnpublishedChanges: false };
      return wait(db.guides[id], 300);
    },
  };

  // Same as the server: every call needs a staff session except signIn (handoff 3, Figma 10).
  return new Proxy(impl, {
    get(target, key: keyof InstitutionsApi) {
      const fn = target[key] as (...args: unknown[]) => Promise<unknown>;
      if (key === "signIn") return fn;
      return (...args: unknown[]) => (signedIn ? fn(...args) : Promise.reject(new ApiError("Sign in to continue.", "UNAUTHORIZED")));
    },
  });
}
