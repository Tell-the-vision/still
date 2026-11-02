export const archiveStrings = {
  heading: "My Archive",
  count: (total: number) => `${String(total).padStart(2, "0")} EXPERIENCES`,
  empty: "No archives yet.",
  scan: "QR Scan",
  error: "Could not load your archive.",
  retry: "Retry",
  missing: "No archive for this exhibition.",
  lastVisited: (iso: string) => `Last visited ${iso.slice(0, 10)}`,
};
