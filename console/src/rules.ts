// Product rules shared by every screen and the mock. The server enforces the same rules (SPEC §9.4);
// these only decide what the UI offers. People in one institution all have the same permissions (SPEC §9.2).
import type { ContentItem, MediaAsset } from "./api";

// ── Content review (SPEC §9.4, §10.8) ─────────────────
export const LOW_CONFIDENCE = 0.7;
export const isLowConfidence = (i: ContentItem) => i.confidence !== null && i.confidence < LOW_CONFIDENCE;

/** The item this one looks like a copy of, while that item is still in review or approved. */
export const duplicateOriginal = (item: ContentItem, items: ContentItem[]) =>
  item.duplicateOf ? items.find((i) => i.id === item.duplicateOf && i.reviewStatus !== "REJECTED") ?? null : null;

/** Why an item cannot be approved, or null. Image rights do not block approval; they block publishing that image. */
export function approvalBlocker(item: ContentItem, items: ContentItem[]): string | null {
  if (item.reviewStatus === "REJECTED") return "Rejected items cannot be approved.";
  if (duplicateOriginal(item, items)) return "Resolve the possible duplicate first.";
  return null;
}

/** "Approve all ready" only takes items a person would not need to read closely. */
export const bulkApprovable = (item: ContentItem, items: ContentItem[]) =>
  item.reviewStatus === "IN_REVIEW" && !approvalBlocker(item, items) && !isLowConfidence(item) && !item.needsReview && item.origin === "SOURCE";

// ── Image rights (SPEC §10.7) ───────────────────────────
export const RIGHTS_LABEL: Record<MediaAsset["rights"], string> = {
  UNCONFIRMED: "Not confirmed",
  CONFIRMED: "Confirmed",
  RESTRICTED: "Restricted",
};

/** Why this image cannot be published, or null. Only CONFIRMED images go live. */
export function rightsIssue(a: MediaAsset): string | null {
  if (a.rights === "RESTRICTED") return "Restricted: take it out of the guide";
  if (a.rights !== "CONFIRMED") return "Rights not confirmed";
  return null;
}

/** Images in approved content that would block publication. */
export const blockingAssets = (items: ContentItem[]) =>
  items
    .filter((i) => i.reviewStatus === "APPROVED")
    .flatMap((i) => i.assets.map((a) => ({ item: i, asset: a, issue: rightsIssue(a) })))
    .filter((x) => x.issue);
