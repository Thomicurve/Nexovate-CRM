export const CLIENT_TIME_ZONE = "America/Argentina/Buenos_Aires";
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: CLIENT_TIME_ZONE,
  calendar: "iso8601", numberingSystem: "latn", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function parts(date: Date) {
  const values = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return ["year", "month", "day", "hour", "minute", "second"].map((key) => Number(values[key]));
}

export function utcToLocal(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const [year, month, day, hour, minute] = parts(date);
  return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function localToUtc(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set<number>();
  // Sample both sides of a possible DST transition, including historical offsets.
  for (const delta of [-2, 0, 2]) {
    const instant = wall + delta * 86_400_000;
    const [y, m, d, h, min, sec] = parts(new Date(instant));
    offsets.add(Date.UTC(y, m - 1, d, h, min, sec) - instant);
  }
  const matches = [...offsets].map((offset) => new Date(wall - offset).toISOString())
    .filter((candidate) => utcToLocal(candidate) === value);
  // Gaps and overlaps require a conscious correction instead of silent conversion.
  return matches.length === 1 ? matches[0] : null;
}
