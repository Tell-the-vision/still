// Exhibition dates are ISO calendar dates; format in UTC so the day never shifts.
const format = (options: Intl.DateTimeFormatOptions) => (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(iso));

const day = format({ day: "numeric", month: "short" });
const dayYear = format({ day: "numeric", month: "short", year: "numeric" });

export const shortRange = (start: string, end: string) => `${day(start)} — ${day(end)}`;
export const longRange = (start: string, end: string) => `${day(start)} — ${dayYear(end)}`;
export const longDate = format({ day: "numeric", month: "long", year: "numeric" });
export const year = format({ year: "numeric" });
