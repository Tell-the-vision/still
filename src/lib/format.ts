/** Shared (client + server) formatting helpers. */

export function formatDate(value: string | number | Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hh}:${mm}`;
}

/** "2026-10-10" → "2026.10.10" */
export function formatIsoDate(iso: string | null | undefined) {
  return iso ? iso.replaceAll("-", ".") : "";
}

export function periodLabel(startDate: string | null, endDate: string | null) {
  const a = formatIsoDate(startDate);
  const b = formatIsoDate(endDate);
  if (a && b) return `${a} – ${b}`;
  return a || b;
}

export function yearOf(iso: string | null | undefined) {
  return iso ? iso.slice(0, 4) : "";
}

export function excerpt(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}
