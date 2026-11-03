export const scrapStrings = {
  keep: "Keep this line",
  remove: "Remove this line",
  keptTitle: "Kept in your collection · tap to remove",
  removeFailed: "Couldn't remove this line.",
  signInHint: "Sign in to keep this line.",
  saveFailed: "Couldn't keep this line.",
  retry: "Retry",
  keptHeading: (total: number) => `Kept lines · ${String(total).padStart(2, "0")}`,
};
