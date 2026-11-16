/**
 * Company time zone helpers. Dates people pick ("Nov 14") mean that day in the company's
 * time zone, not in UTC. Uses the built-in Intl API, so no extra dependency.
 */
export const DEFAULT_TIMEZONE = "America/Chicago";

export const COMMON_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Puerto_Rico", "America/Toronto", "America/Mexico_City", "UTC",
];

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Milliseconds the zone is ahead of UTC at the given instant (negative in the Americas). */
function offsetMs(instant: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The UTC instant (ISO string) when the given calendar day starts in the time zone. */
export function zonedDayStart(day: string, tz: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetMs(guess, tz);
  t = guess - offsetMs(t, tz); // correct across daylight-saving changes
  return new Date(t).toISOString();
}

/** Today's date (YYYY-MM-DD) in the time zone, optionally shifted by a number of days. */
export function zonedToday(tz: string, addDays = 0): string {
  const now = new Date(Date.now() + addDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const formatZonedDate = (iso: string, tz: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" });

/** "2026-11-14 19:05" in the time zone, for spreadsheets. */
export function formatZonedDateTime(iso: string | null, tz: string): string | null {
  if (!iso) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
