import { CLIENT_TIME_ZONE } from "@/lib/clients/dates";
import { calendarDate, type MetricsQuery } from "./model";
export type MetricsSearchParams = Record<string, string | string[] | undefined>;
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: CLIENT_TIME_ZONE,
  calendar: "iso8601", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit" });

export function previousMetricsQuery(query: MetricsQuery): MetricsQuery | null {
  const from = calendarDate(query.from), until = calendarDate(query.until);
  if (!from || !until || query.from > query.until) return null;
  const days = (until.getTime() - from.getTime()) / 86_400_000 + 1;
  const previousFrom = new Date(from.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const previousUntil = new Date(from.getTime() - 86_400_000).toISOString().slice(0, 10);
  return calendarDate(previousFrom) && calendarDate(previousUntil) ? { ...query, from: previousFrom, until: previousUntil } : null;
}

export function metricsPreset(preset: "seven" | "month" | "previous-month", now = new Date()): Pick<MetricsQuery, "from" | "until"> | null {
  if (!Number.isFinite(now.getTime())) return null;
  const parts = Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  let until = `${parts.year}-${parts.month}-${parts.day}`;
  const first = calendarDate(until);
  if (!first) return null;
  if (preset === "seven") first.setUTCDate(first.getUTCDate() - 6);
  else {
    first.setUTCDate(1);
    if (preset === "previous-month") {
      first.setUTCDate(0); until = first.toISOString().slice(0, 10); first.setUTCDate(1);
    }
  }
  const from = first.toISOString().slice(0, 10);
  return calendarDate(from) && calendarDate(until) ? { from, until } : null;
}

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
