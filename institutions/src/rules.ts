// Product rules from the developer handoff, shared by every screen and the mock.
// The server must enforce the same rules; these only decide what the UI offers.
import type { ContentItem, MediaAsset, Me, MemberRole } from "./api";

// ── Roles (handoff 3) ───────────────────────────────────
export const ROLES: Record<MemberRole, { label: string; can: string }> = {
  INSTITUTION_ADMIN: { label: "Institution admin", can: "Manage the workspace, invite people and assign roles; create, edit, publish and unpublish exhibitions." },
  CURATOR: { label: "Curator / Editor", can: "Create exhibitions, upload sources, edit extracted content, compose the guide and preview. Publishes only if allowed." },
  REVIEWER: { label: "Reviewer / Approver", can: "Review content, approve or reject items and confirm rights. No workspace administration." },
  READ_ONLY: { label: "Read-only", can: "View the workspace and draft or published status. No edits." },
};
export const ROLE_ORDER: MemberRole[] = ["INSTITUTION_ADMIN", "CURATOR", "REVIEWER", "READ_ONLY"];

export type Action = "manageWorkspace" | "edit" | "review" | "publish";
export function can(me: Pick<Me, "role" | "canPublish"> | null, action: Action): boolean {
  if (!me) return false;
  const admin = me.role === "INSTITUTION_ADMIN";
  switch (action) {
    case "manageWorkspace": return admin;
    case "edit": return admin || me.role === "CURATOR";
    case "review": return admin || me.role === "REVIEWER";
    case "publish": return admin || (me.role === "CURATOR" && me.canPublish);
  }
}
export const NO_PERMISSION: Record<Action, string> = {
  manageWorkspace: "Only an institution admin can change this.",
  edit: "Your role can view this but not edit it.",
  review: "Approving and rejecting is for reviewers and institution admins.",
  publish: "You don't have permission to publish. Ask an institution admin.",
};

// ── Content review (handoff 2.5–2.6, 4.2, 9) ─────────────
export const LOW_CONFIDENCE = 0.7;
export const isLowConfidence = (i: ContentItem) => i.confidence !== null && i.confidence < LOW_CONFIDENCE;

/** The item this one looks like a copy of, while that item is still in the dataset. */
export const duplicateOriginal = (item: ContentItem, items: ContentItem[]) =>
  item.duplicateOf ? items.find((i) => i.id === item.duplicateOf && !i.removed) ?? null : null;

/** Why an item cannot be approved, or null. Image rights do not block approval; they block publishing that image. */
export function approvalBlocker(item: ContentItem, items: ContentItem[]): string | null {
  if (item.removed) return "Restore this item before approving it.";
  if (duplicateOriginal(item, items)) return "Resolve the possible duplicate first.";
  return null;
}

/** "Approve all ready" only takes items a person would not need to read closely. */
export const bulkApprovable = (item: ContentItem, items: ContentItem[]) =>
  item.reviewStatus === "IN_REVIEW" && !approvalBlocker(item, items) && !isLowConfidence(item) && !item.needsReview && item.origin === "SOURCE";

// ── Rights (handoff 4.6, 9, 10) ─────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

/** Why this asset cannot be published, or null. Excluded assets are never published, so they never block. */
export function rightsIssue(a: MediaAsset): string | null {
  if (a.excluded) return null;
  if (a.usagePermission === "DENIED") return "Permission denied";
  if (a.usagePermission !== "GRANTED") return "Permission not confirmed";
  if (!a.copyrightHolder.trim()) return "Copyright holder missing";
  if (a.expiresOn && a.expiresOn < today()) return "Permission expired";
  return null;
}

/** Assets in approved content that would block publication. */
export const blockingAssets = (items: ContentItem[]) =>
  items
    .filter((i) => !i.removed && i.reviewStatus === "APPROVED")
    .flatMap((i) => i.assets.map((a) => ({ item: i, asset: a, issue: rightsIssue(a) })))
    .filter((x) => x.issue);
