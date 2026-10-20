// Calendar-day helpers. A "day" is always a `yyyy-mm-dd` string in some IANA time zone.

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day `instant` falls on in `timeZone` (DST-aware, via ICU). */
export function dayIn(instant: Date, timeZone: string): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Pure calendar arithmetic on `yyyy-mm-dd`; no time zone involved. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** True for a real calendar date in `yyyy-mm-dd` form (rejects 2026-02-30). */
export function isValidDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Returns the canonical spelling of an IANA zone name, or null if it is not one.
 * Raw offsets such as "+03:00" are rejected even though newer ICU accepts them.
 */
export function normalizeTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || !/^[A-Za-z]/.test(value)) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Parses an `X-Now` header. An offset is required so the instant is unambiguous. */
export function parseNow(value: string): Date | null {
  if (!ISO_WITH_OFFSET.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC timestamp without milliseconds, as the old app returned it: `2026-10-05T06:15:00Z`. */
export function toTimestamp(instant: Date): string {
  return instant.toISOString().replace(/\.\d{3}Z$/, "Z");
}
