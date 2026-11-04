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

export const formatMB = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

export type LibraryStatus = "live" | "scheduled" | "ended" | "draft";

/** Library status is derived from publication status + dates, so the server only stores DRAFT | PUBLISHED. */
export function libraryStatus(e: Exhibition, today = new Date()): LibraryStatus {
  if (e.status === "DRAFT") return "draft";
  const t = `${today.getFullYear()}-${dd(today.getMonth() + 1)}-${dd(today.getDate())}`;
  if (e.startDate && t < e.startDate) return "scheduled";
  if (e.endDate && t > e.endDate) return "ended";
  return "live";
}

export const VISITOR_HOST = "still.art/e/";
export const visitorUrl = (code: string) => `${VISITOR_HOST}${code}`;
