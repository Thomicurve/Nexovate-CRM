import { CLIENT_TIME_ZONE } from "./dates";
import { STATUSES, type Client, type ClientStatus } from "./model";

export type SearchParams = Record<string, string | string[] | undefined>;
export type Filters = { name: string; statuses: ClientStatus[]; from: string; until: string;
  fromUtc: string | null; untilUtc: string | null; page: number };
export type ListResult = { kind: "found"; filters: Filters; rows: Client[]; count: number } |
  { kind: "unavailable" | "out_of_range"; filters: Filters } | { kind: "invalid"; message: string };
export const PAGE_SIZE = 50;
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: CLIENT_TIME_ZONE,
  calendar: "iso8601", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit" });

function calendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day ? date : null;
}
function localDay(instant: number) {
  const parts = Object.fromEntries(dayFormatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
// Find the first instant of a calendar day, including a skipped midnight.
// Searching the transition avoids applying the form's ambiguous wall-time rule.
function dayStart(date: Date) {
  const target = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  const hour = 3_600_000, origin = date.getTime() - 36 * hour;
  for (let instant = origin; instant <= origin + 72 * hour; instant += hour) {
    if (localDay(instant) !== target) continue;
    let low = instant - hour, high = instant;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (localDay(middle) === target) high = middle; else low = middle;
    }
    return new Date(high).toISOString();
  }
  return null;
}

export function parseFilters(params: SearchParams): { ok: true; filters: Filters } | { ok: false; message: string } {
  const invalid = { ok: false as const, message: "Revisá el nombre, los estados y el rango de fechas de los filtros." };
  if (Object.keys(params).some((key) => !["nombre", "estado", "desde", "hasta", "pagina"].includes(key)) ||
    ["nombre", "desde", "hasta", "pagina"].some((key) => Array.isArray(params[key]))) return invalid;
  const name = String(params.nombre ?? "").trim(), from = String(params.desde ?? ""), until = String(params.hasta ?? "");
  const states = params.estado === undefined ? [] : Array.isArray(params.estado) ? params.estado : [params.estado];
  const pageText = String(params.pagina ?? "1"), page = Number(pageText);
  if (name.length > 200 || states.some((state) => !STATUSES.includes(state as ClientStatus)) ||
    !/^[1-9]\d*$/.test(pageText) || !Number.isSafeInteger(page * PAGE_SIZE)) return invalid;
  const fromDate = from ? calendarDay(from) : null, untilDate = until ? calendarDay(until) : null;
  if (from && !fromDate || until && !untilDate || from && until && from > until) return invalid;
  const fromUtc = fromDate ? dayStart(fromDate) : null;
  if (untilDate) untilDate.setUTCDate(untilDate.getUTCDate() + 1);
  const untilUtc = untilDate ? dayStart(untilDate) : null;
  if (from && !fromUtc || until && !untilUtc) return invalid;
  return { ok: true, filters: { name, statuses: STATUSES.filter((state) => states.includes(state)),
    from, until, fromUtc, untilUtc, page } };
}

export function listPath(filters: Filters, page = filters.page) {
  const query = new URLSearchParams();
  if (filters.name) query.set("nombre", filters.name);
  for (const state of filters.statuses) query.append("estado", state);
  if (filters.from) query.set("desde", filters.from);
  if (filters.until) query.set("hasta", filters.until);
  if (page > 1) query.set("pagina", String(page));
  return `/clientes${query.size ? `?${query}` : ""}`;
}
