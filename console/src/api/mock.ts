// In-memory ConsoleApi for working without a backend. State resets on reload.
import type { ConsoleApi, ContentItem, Exhibition, Guide, PublicationCheck } from "./types";
import { emptySeed, sampleSeed, type Seed } from "./seed";

const wait = <T,>(value: T, ms = 120): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(value)), ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const now = () => new Date().toISOString();

export function createMockApi(kind: "sample" | "empty"): ConsoleApi {
  const db: Seed = kind === "empty" ? emptySeed() : sampleSeed();

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
  const touch = (id: string) => { exhibition(id).updatedAt = now(); };
  const log = (text: string) => db.activity.unshift({ id: uid(), at: now(), actor: db.me.name, text });

  const derivedChecks = (id: string): PublicationCheck[] => {
    const items = db.items[id] ?? [];
    const total = items.reduce((n, i) => n + i.itemCount, 0);
    const pending = items.reduce((n, i) => n + i.pendingCount, 0);
    return (db.checks[id] ?? []).map((c) =>
      c.title === "Content approval" ? { ...c, value: `${total - pending} / ${total}`, ok: total > 0 && pending === 0 } : c,
    );
  };

  return {
    getWorkspace: () => wait(db.workspace),

    async getWorkspaceSummary() {
      const attention = db.exhibitions
        .map((e) => ({ exhibitionId: e.id, title: e.title, pendingCount: (db.items[e.id] ?? []).reduce((n, i) => n + i.pendingCount, 0) }))
        .filter((a) => a.pendingCount > 0);
      return wait({ attention, activity: [...db.activity].sort((a, b) => b.at.localeCompare(a.at)), memberCount: db.members.length });
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
    signOut: () => wait(undefined, 300),
    getWorkspaceSettings: () => wait(db.settings),
    async updateWorkspaceSettings(patch) {
      db.settings = { ...db.settings, ...patch, publishing: { ...db.settings.publishing, ...patch.publishing } };
      db.workspace.institutionName = db.settings.institutionName;
      return wait(db.settings, 300);
    },
    listVenues: () => wait(db.venues),
    async createVenue(v) {
      if (db.venues.some((x) => x.code === v.code)) throw new Error(`Venue code "${v.code}" is already used`);
      const venue = { ...v, id: uid() };
      db.venues.push(venue);
      return wait(venue);
    },
    listMembers: () => wait(db.members),
    async inviteMember(email, role) {
      if (db.members.some((m) => m.email.toLowerCase() === email.toLowerCase())) throw new Error(`${email} is already in this workspace`);
      const m = { id: uid(), name: null, email, role, status: "INVITED" as const };
      db.members.push(m);
      log(`Invited ${email}`);
      return wait(m, 300);
    },
    async updateMemberRole(memberId, role) {
      const m = db.members.find((x) => x.id === memberId);
      if (!m) throw new Error("Member not found");
      m.role = role;
      return wait(m);
    },
    async removeMember(memberId) {
      if (memberId === db.me.id) throw new Error("You cannot remove yourself");
      db.members = db.members.filter((m) => m.id !== memberId);
      return wait(undefined);
    },
    sendSupportRequest: () => wait({ ticketId: `T-${Math.floor(1000 + Math.random() * 9000)}` }, 500),

    listExhibitions: () => wait(db.exhibitions),
    async createExhibition() {
      const e: Exhibition = {
        id: uid(), code: `untitled-${db.exhibitions.length + 1}`, title: "Untitled Exhibition", subtitle: null,
        venueName: db.workspace.institutionName, startDate: null, endDate: null, status: "DRAFT", updatedAt: now(),
      };
      db.exhibitions.unshift(e);
      db.guides[e.id] = { sections: [], themes: [], hasUnpublishedChanges: false };
      return wait(e);
    },
    async updateExhibition(id, patch) {
      Object.assign(exhibition(id), patch, { updatedAt: now() });
      return wait(exhibition(id));
    },
    async publishExhibition(id) {
      Object.assign(exhibition(id), { status: "PUBLISHED", updatedAt: now() });
      log(`Published ${exhibition(id).title}`);
      return wait(exhibition(id), 400);
    },

    listFiles: (id) => wait(db.files[id] ?? []),
    async uploadFile(id, file) {
      const f = {
        id: uid(), name: file.name, format: file.name.split(".").pop()?.toUpperCase() ?? "FILE", summary: null,
        sizeBytes: file.size, uploadedAt: now(), status: "READY" as const,
      };
      (db.files[id] ??= []).push(f);
      touch(id);
      log(`Uploaded ${file.name} to ${exhibition(id).title}`);
      return wait(f, 800);
    },
    async deleteFile(id, fileId) {
      db.files[id] = (db.files[id] ?? []).filter((f) => f.id !== fileId);
      return wait(undefined);
    },
    async startAnalysis(id) {
      (db.events[id] ??= []).push({ id: uid(), at: now(), title: "Analysis requested", detail: `${db.files[id]?.length ?? 0} files`, status: "IN_PROGRESS" });
      return wait(undefined, 300);
    },
    listProcessingEvents: (id) => wait(db.events[id] ?? []),

    listContentItems: (id) => wait([...(db.items[id] ?? [])].sort((a, b) => a.order - b.order)),
    async updateContentItem(itemId, patch) {
      Object.assign(findItem(itemId), patch);
      return wait(findItem(itemId));
    },
    async approveContentItem(itemId) {
      findItem(itemId).pendingCount = 0;
      return wait(findItem(itemId));
    },

    listPublicationChecks: (id) => wait(derivedChecks(id)),

    getGuide: (id) => wait<Guide>(db.guides[id] ?? { sections: [], themes: [], hasUnpublishedChanges: false }),
    async saveGuide(id, guide) {
      db.guides[id] = { ...guide, hasUnpublishedChanges: true };
      return wait(db.guides[id]);
    },
    async publishGuide(id) {
      db.guides[id] = { ...(db.guides[id] ?? { sections: [], themes: [] }), hasUnpublishedChanges: false };
      return wait(db.guides[id], 300);
    },
  };
}
