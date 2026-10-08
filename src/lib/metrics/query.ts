import { CLIENT_TIME_ZONE } from "@/lib/clients/dates";
import { calendarDate, type MetricsQuery } from "./model";
export type MetricsSearchParams = Record<string, string | string[] | undefined>;
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: CLIENT_TIME_ZONE,
  calendar: "iso8601", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit" });

export function parseMetricsQuery(params: MetricsSearchParams, now = new Date()):
  { ok: true; query: MetricsQuery } | { ok: false; message: string } {
  const invalid = { ok: false as const, message: "Revisá el rango de fechas y la agrupación." };
  if (Object.keys(params).some((key) => !["desde", "hasta", "agrupacion"].includes(key)) ||
    ["desde", "hasta", "agrupacion"].some((key) => Array.isArray(params[key])) || !Number.isFinite(now.getTime())) return invalid;
  const parts = Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const first = calendarDate(today);
  if (!first) return invalid;
  first.setUTCDate(first.getUTCDate() - 6);
  const from = params.desde ?? first.toISOString().slice(0, 10), until = params.hasta ?? today;
  const grouping = params.agrupacion ?? "day";
  if (typeof from !== "string" || typeof until !== "string" || !calendarDate(from) || !calendarDate(until) || from > until ||
    grouping !== "day" && grouping !== "month" && grouping !== "year") return invalid;
  return { ok: true, query: { from, until, grouping } };
}
