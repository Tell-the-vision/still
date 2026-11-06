import type { Exhibition, ISODate, ISODateTime } from "./api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parts = (d: ISODate) => {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
};
const dd = (n: number) => String(n).padStart(2, "0");

/** "20 Mar – 28 Jun 2026", or "27 Aug 2026 – 09 Feb 2027" across years. */
export function formatPeriod(start: ISODate | null, end: ISODate | null) {
  if (!start || !end) return "Dates not set";
  const a = parts(start), b = parts(end);
  const left = a.y === b.y ? `${dd(a.day)} ${MONTHS[a.m - 1]}` : `${dd(a.day)} ${MONTHS[a.m - 1]} ${a.y}`;
  return `${left} – ${dd(b.day)} ${MONTHS[b.m - 1]} ${b.y}`;
}

export function formatTime(iso: ISODateTime | null) {
  if (!iso) return "Pending";
  const d = new Date(iso);
  return `${dd(d.getHours())}:${dd(d.getMinutes())}`;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "Today", "Yesterday", or "28 Oct". */
export function formatUpdated(iso: ISODateTime) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return `${dd(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

export function formatAdded(iso: ISODateTime) {
  return `${formatUpdated(iso)}, ${formatTime(iso)}`;
}

export const formatMB = (bytes: number) => (bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : `${(bytes / 1e6).toFixed(1)} MB`);

export type LibraryStatus = "live" | "scheduled" | "ended" | "draft";

/** Library status is derived from publication status + dates. An UNPUBLISHED guide is offline and editable like a draft. */
export function libraryStatus(e: Exhibition, today = new Date()): LibraryStatus {
  if (e.status !== "PUBLISHED") return "draft";
  const t = `${today.getFullYear()}-${dd(today.getMonth() + 1)}-${dd(today.getDate())}`;
  if (e.startDate && t < e.startDate) return "scheduled";
  if (e.endDate && t > e.endDate) return "ended";
  return "live";
}

// Where visitors open a guide: the origin the server also encodes in printed QR codes (set at build time,
// see vite.config.ts). Links, the address shown to staff and QR codes all come from this one value.
// The visitor app's origin, for the addresses the console shows and copies (the QR images come from the server, which
// encodes STILL_ORIGIN). Set at build time when it is configured; otherwise the console's own origin, since one server
// serves both apps (in dev, the console's server proxies the visitor app).
export const VISITOR_ORIGIN: string = import.meta.env.VITE_VISITOR_ORIGIN || window.location.origin;
export const VISITOR_HOST = `${new URL(VISITOR_ORIGIN).host}/e/`;
/** The guide's full address, as linked and as encoded in its QR. */
// An exhibition's guide, or with `artwork` (the first 8 characters of its content id) the guide opened at that artwork:
// the address in the QR posted beside the work (SPEC §1.2).
export const guideUrl = (code: string, artwork?: string) => `${VISITOR_ORIGIN}/e/${encodeURIComponent(code)}${artwork ? `/${artwork}` : ""}`;
export const visitorUrl = (code: string, artwork?: string) => `${VISITOR_HOST}${code}${artwork ? `/${artwork}` : ""}`;

