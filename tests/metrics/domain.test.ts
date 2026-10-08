import { describe, expect, it } from "vitest";
import { parseMetricsQuery } from "@/lib/metrics/query";
import { METRIC_STATUSES, bucketCount, decodeMetrics, type MetricsQuery } from "@/lib/metrics/model";

const query: MetricsQuery = { from: "2026-10-07", until: "2026-10-09", grouping: "day" };
export function response(q: MetricsQuery = query) {
  return { kind: "ready", ...q, metrics: METRIC_STATUSES.map((status) => ({ status, historicalTotal: 8,
    rangeTotal: 2, buckets: ["2026-10-07", "2026-10-08", "2026-10-09"].map((start, i) => ({ start, count: i === 1 ? 2 : 0 })) })) };
}
describe("dashboard dates and response contract", () => {
  it("defaults to seven local calendar days including today, independent of browser zone", () => {
    expect(parseMetricsQuery({}, new Date("2026-10-09T02:59:59Z"))).toEqual({ ok: true,
      query: { from: "2026-10-02", until: "2026-10-08", grouping: "day" } });
  });
  it.each([{}, { desde: "2024-02-29", hasta: "2024-02-29" }, { desde: "1900-01-01", hasta: "9999-12-31", agrupacion: "year" }])("accepts real calendar dates: %j", (params) => {
    expect(parseMetricsQuery(params).ok).toBe(true);
  });
  it.each([
    { desde: "2026-02-29" }, { hasta: "2026-04-31" }, { desde: "1899-12-31" }, { hasta: "10000-01-01" },
    { desde: "2026-10-09", hasta: "2026-10-08" }, { agrupacion: "week" }, { agrupacion: "DAY" },
    { desde: ["2026-10-07"] }, { hasta: ["2026-10-07", "2026-10-08"] }, { agrupacion: ["day"] },
    { desde: "" }, { desde: "2026-1-01" }, { hasta: " 2026-10-07" }, { extra: "pollution" },
  ])("rejects invalid, repeated or polluted parameters: %j", (params) => expect(parseMetricsQuery(params).ok).toBe(false));
  it("accepts complete ordered zero-filled series and distinguishes real empty", () => {
    expect(decodeMetrics(response(), query)).toEqual(response());
    const empty = response(); empty.metrics.forEach((m) => { m.historicalTotal = 0; m.rangeTotal = 0; m.buckets.forEach((b) => { b.count = 0; }); });
    expect(decodeMetrics(empty, query)).toEqual(empty);
  });
  it.each([
    (r: ReturnType<typeof response>) => { r.metrics.pop(); },
    (r: ReturnType<typeof response>) => { r.metrics[1].status = "Contactado"; },
    (r: ReturnType<typeof response>) => { r.metrics[0].historicalTotal = 1; },
    (r: ReturnType<typeof response>) => { r.metrics[0].rangeTotal = 3; },
    (r: ReturnType<typeof response>) => { r.metrics[0].buckets.reverse(); },
    (r: ReturnType<typeof response>) => { r.metrics[0].buckets.pop(); },
    (r: ReturnType<typeof response>) => { r.metrics[0].buckets[0].start = "2026-10-06"; },
    (r: ReturnType<typeof response>) => { r.metrics[0].buckets[0].count = -1; },
    (r: ReturnType<typeof response>) => { r.metrics[0].historicalTotal = Number.MAX_SAFE_INTEGER + 1; },
    (r: ReturnType<typeof response>) => { r.metrics[0].buckets[0].count = 0.5; },
    (r: ReturnType<typeof response>) => { r.from = "2026-10-08"; },
  ])("fails closed on malformed or incoherent responses", (mutate) => {
    const data = response(); mutate(data); expect(decodeMetrics(data, query)).toBeNull();
  });
  it("uses calendar month/year buckets, with partial edges rather than rolling intervals", () => {
    for (const grouping of ["month", "year"] as const) {
      const q = { from: "2025-12-31", until: "2026-01-02", grouping };
      const starts = grouping === "month" ? ["2025-12-01", "2026-01-01"] : ["2025-01-01", "2026-01-01"];
      const r = { kind: "ready", ...q, metrics: METRIC_STATUSES.map((status) => ({ status, historicalTotal: 1, rangeTotal: 1,
        buckets: starts.map((start, i) => ({ start, count: i })) })) };
      expect(decodeMetrics(r, q)).toEqual(r);
    }
  });
  it.each([
    ["2026-01-01", "2026-01-31", 31], ["2026-04-01", "2026-04-30", 30],
    ["2024-02-01", "2024-02-29", 29], ["2026-02-01", "2026-02-28", 28],
    ["2008-10-18", "2008-10-20", 3], ["2009-03-14", "2009-03-16", 3],
  ])("counts calendar days without assuming month length or DST duration: %s..%s", (from, until, expected) => {
    expect(bucketCount({ from, until, grouping: "day" })).toBe(expected);
  });
  it("defaults correctly across a leap month and a local year transition", () => {
    expect(parseMetricsQuery({}, new Date("2024-03-01T03:00:00Z"))).toMatchObject({ query: { from: "2024-02-24", until: "2024-03-01" } });
    expect(parseMetricsQuery({}, new Date("2026-01-01T02:59:59Z"))).toMatchObject({ query: { from: "2025-12-25", until: "2025-12-31" } });
  });
  it("rejects unexpected schema fields and cross-metric impossible historical totals", () => {
    expect(decodeMetrics({ ...response(), extra: true }, query)).toBeNull();
    const r = response(); r.metrics[1].historicalTotal = 9; expect(decodeMetrics(r, query)).toBeNull();
  });
  it("declares excessive series without truncation or loss of totals", () => {
    const q = { from: "1900-01-01", until: "9999-12-31", grouping: "day" as const };
    const r = { kind: "too_many_buckets", bucketCount: 2958464, ...q, metrics: METRIC_STATUSES.map((status) => ({ status, historicalTotal: 20, rangeTotal: 20 })) };
    expect(decodeMetrics(r, q)).toEqual(r);
    expect(decodeMetrics(r, query)).toBeNull();
    expect(decodeMetrics({ ...r, bucketCount: 2001 }, q)).toBeNull();
    expect(decodeMetrics({ ...r, kind: "ready" }, q)).toBeNull();
    expect(decodeMetrics({ ...r, metrics: r.metrics.map((m) => ({ ...m, buckets: [] })) }, q)).toBeNull();
  });
});
