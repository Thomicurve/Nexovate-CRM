import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardMetrics } from "@/lib/metrics/server";
import DashboardPage from "@/app/(crm)/dashboard/page";
const f = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-member", () => ({ requireMember: f.guard }));
const params = { desde: "2026-10-07", hasta: "2026-10-07", agrupacion: "day" };
const data = { kind: "ready", from: params.desde, until: params.hasta, grouping: "day",
  metrics: ["Contactado", "Reunión agendada", "Cerrado"].map((status) => ({ status, historicalTotal: 0, rangeTotal: 0,
    buckets: [{ start: params.desde, count: 0 }] })) };
describe("readonly dashboard server boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); f.guard.mockResolvedValue({ client: { rpc: f.rpc } }); f.rpc.mockImplementation((_name, q) => Promise.resolve({ data: { ...data, from: q.p_from, until: q.p_until, grouping: q.p_grouping, metrics: data.metrics.map((m) => ({ ...m, buckets: [{ start: q.p_from, count: 0 }] })) }, error: null })); });
  it("guards once before current and previous aggregation RPCs, never fetches paginated milestones", async () => {
    expect(await getDashboardMetrics(params)).toMatchObject({ kind: "ready", metrics: data.metrics });
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.rpc).toHaveBeenCalledTimes(2);
    expect(f.guard.mock.invocationCallOrder[0]).toBeLessThan(f.rpc.mock.invocationCallOrder[0]);
    expect(f.rpc).toHaveBeenCalledWith("dashboard_metrics", { p_from: params.desde, p_until: params.hasta, p_grouping: "day" });
    expect(f.rpc).toHaveBeenNthCalledWith(2, "dashboard_metrics", { p_from: "2026-10-06", p_until: "2026-10-06", p_grouping: "day" });
  });
  it("guards even invalid params and does not query them", async () => {
    expect(await getDashboardMetrics({ agrupacion: "bad" })).toMatchObject({ kind: "invalid" });
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each(["anonymous", "denied", "unavailable"])("does not query blocked access: %s", async (kind) => {
    f.guard.mockRejectedValue(new Error(kind)); await expect(getDashboardMetrics(params)).rejects.toThrow(kind); expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: null }, { data: [], error: null }, { data, error: { message: "internal" } },
    { data: { ...data, metrics: [] }, error: null }])("reports provider/schema failures without inventing zero totals", async (r) => {
    f.rpc.mockResolvedValue(r); expect(await getDashboardMetrics(params)).toMatchObject({ kind: "unavailable" }); expect(f.rpc).toHaveBeenCalledOnce();
  });
  it("reports transport failure safely", async () => {
    f.rpc.mockRejectedValue(new Error("private")); expect(await getDashboardMetrics(params)).toMatchObject({ kind: "unavailable" }); expect(f.rpc).toHaveBeenCalledOnce();
  });
  it("returns excessive-series totals as a declared result, not invalid or unavailable", async () => {
    const r = { kind: "too_many_buckets", from: "1900-01-01", until: "9999-12-31", grouping: "year", bucketCount: 8100,
      metrics: data.metrics.map(({ status }) => ({ status, historicalTotal: 12, rangeTotal: 12 })) };
    f.rpc.mockResolvedValue({ data: r, error: null });
    expect(await getDashboardMetrics({ desde: r.from, hasta: r.until, agrupacion: r.grouping })).toMatchObject({ ...r, comparison: { kind: "unavailable", query: null } });
    expect(f.rpc).toHaveBeenCalledOnce();
  });
  it("protects the dashboard page through guarded DAL without duplicating the metrics RPC", async () => {
    await DashboardPage({ searchParams: Promise.resolve(params) });
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.rpc).toHaveBeenCalledTimes(2);
    f.guard.mockRejectedValue(new Error("blocked")); f.rpc.mockClear();
    await expect(DashboardPage({ searchParams: Promise.resolve(params) })).rejects.toThrow("blocked");
    expect(f.rpc).not.toHaveBeenCalled();
  });
});

it("keeps current confirmed data when the prior RPC is unavailable or malformed", async () => {
  f.guard.mockResolvedValue({ client: { rpc: f.rpc } });
  for (const previous of [{ data: null, error: { message: "private" } }, { data, error: null }]) {
    f.rpc.mockReset().mockResolvedValueOnce({ data, error: null }).mockResolvedValueOnce(previous);
    const result = await getDashboardMetrics(params);
    expect(result).toMatchObject({ kind: "ready", metrics: data.metrics, comparison: { kind: "unavailable", query: { from: "2026-10-06", until: "2026-10-06" } } });
  }
});
