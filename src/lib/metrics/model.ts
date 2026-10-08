export const METRIC_STATUSES = ["Contactado", "Reunión agendada", "Cerrado"] as const;
export type MetricsQuery = { from: string; until: string; grouping: "day" | "month" | "year" };
export const MAX_METRIC_BUCKETS = 2000;
export type MetricTotals = { status: typeof METRIC_STATUSES[number]; historicalTotal: number; rangeTotal: number };
export type Metric = MetricTotals & { buckets: { start: string; count: number }[] };
export type MetricsData = ({ kind: "ready"; metrics: Metric[] } |
  { kind: "too_many_buckets"; bucketCount: number; metrics: MetricTotals[] }) & MetricsQuery;
export type MetricsResult = MetricsData | { kind: "invalid"; message: string } | { kind: "unavailable"; query: MetricsQuery };

export function calendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && year <= 9999 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day ? date : null;
}
export function bucketCount(query: MetricsQuery) {
  const from = calendarDate(query.from)!, until = calendarDate(query.until)!;
  if (query.grouping === "day") return (until.getTime() - from.getTime()) / 86_400_000 + 1;
  const years = until.getUTCFullYear() - from.getUTCFullYear();
  return query.grouping === "year" ? years + 1 : years * 12 + until.getUTCMonth() - from.getUTCMonth() + 1;
}
function bucketStarts(query: MetricsQuery) {
  const date = calendarDate(query.from)!;
  if (query.grouping !== "day") date.setUTCDate(1);
  if (query.grouping === "year") date.setUTCMonth(0);
  return Array.from({ length: bucketCount(query) }, () => {
    const start = date.toISOString().slice(0, 10);
    if (query.grouping === "day") date.setUTCDate(date.getUTCDate() + 1);
    else if (query.grouping === "month") date.setUTCMonth(date.getUTCMonth() + 1);
    else date.setUTCFullYear(date.getUTCFullYear() + 1);
    return start;
  });
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: string[]) {
  return Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}
function count(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }

// Treat incomplete or incoherent RPC data as unavailable, never as an empty history.
export function decodeMetrics(value: unknown, query: MetricsQuery): MetricsData | null {
  if (!object(value) || !calendarDate(query.from) || !calendarDate(query.until) || query.from > query.until ||
    !["day", "month", "year"].includes(query.grouping)) return null;
  const size = bucketCount(query), oversized = size > MAX_METRIC_BUCKETS;
  if (value.kind !== (oversized ? "too_many_buckets" : "ready") || value.from !== query.from ||
    value.until !== query.until || value.grouping !== query.grouping ||
    !keys(value, ["kind", "from", "until", "grouping", "metrics", ...(oversized ? ["bucketCount"] : [])]) ||
    oversized && value.bucketCount !== size || !Array.isArray(value.metrics) || value.metrics.length !== 3) return null;
  const starts = oversized ? [] : bucketStarts(query);
  const totals: MetricTotals[] = [], metrics: Metric[] = [];
  for (const [index, raw] of value.metrics.entries()) {
    if (!object(raw) || !keys(raw, ["status", "historicalTotal", "rangeTotal", ...(oversized ? [] : ["buckets"])]) ||
      raw.status !== METRIC_STATUSES[index] || !count(raw.historicalTotal) || !count(raw.rangeTotal) ||
      raw.rangeTotal > raw.historicalTotal) return null;
    const total = { status: METRIC_STATUSES[index], historicalTotal: raw.historicalTotal, rangeTotal: raw.rangeTotal };
    totals.push(total);
    if (oversized) continue;
    if (!Array.isArray(raw.buckets) || raw.buckets.length !== size) return null;
    const buckets: Metric["buckets"] = [];
    let sum = 0;
    for (const [i, bucket] of raw.buckets.entries()) {
      if (!object(bucket) || !keys(bucket, ["start", "count"]) || bucket.start !== starts[i] || !count(bucket.count)) return null;
      sum += bucket.count;
      if (!Number.isSafeInteger(sum)) return null;
      buckets.push({ start: starts[i], count: bucket.count });
    }
    if (sum !== total.rangeTotal) return null;
    metrics.push({ ...total, buckets });
  }
  if (totals.some((metric) => metric.historicalTotal > totals[0].historicalTotal)) return null;
  return oversized ? { kind: "too_many_buckets", ...query, bucketCount: size, metrics: totals } : { kind: "ready", ...query, metrics };
}
