import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardMetrics } from "@/lib/metrics/server";
const f = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-member", () => ({ requireMember: f.guard }));
const params = { desde: "2026-10-07", hasta: "2026-10-07", agrupacion: "day" };
const data = { kind: "ready", from: params.desde, until: params.hasta, grouping: "day",
  metrics: ["Contactado", "Reunión agendada", "Cerrado"].map((status) => ({ status, historicalTotal: 0, rangeTotal: 0,
    buckets: [{ start: params.desde, count: 0 }] })) };
describe("readonly dashboard server boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); f.guard.mockResolvedValue({ client: { rpc: f.rpc } }); f.rpc.mockResolvedValue({ data, error: null }); });
  it("guards before one aggregation RPC, never fetches paginated milestones", async () => {
    expect(await getDashboardMetrics(params)).toMatchObject({ kind: "ready", metrics: data.metrics });
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.rpc).toHaveBeenCalledOnce();
    expect(f.guard.mock.invocationCallOrder[0]).toBeLessThan(f.rpc.mock.invocationCallOrder[0]);
    expect(f.rpc).toHaveBeenCalledWith("dashboard_metrics", { p_from: params.desde, p_until: params.hasta, p_grouping: "day" });
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
    f.rpc.mockResolvedValue(r); expect(await getDashboardMetrics(params)).toMatchObject({ kind: "unavailable" });
  });
  it("reports transport failure safely", async () => {
    f.rpc.mockRejectedValue(new Error("private")); expect(await getDashboardMetrics(params)).toMatchObject({ kind: "unavailable" });
  });
  it("returns excessive-series totals as a declared result, not invalid or unavailable", async () => {
    const r = { kind: "too_many_buckets", from: "1900-01-01", until: "9999-12-31", grouping: "year", bucketCount: 8100,
      metrics: data.metrics.map(({ status }) => ({ status, historicalTotal: 12, rangeTotal: 12 })) };
    f.rpc.mockResolvedValue({ data: r, error: null });
    expect(await getDashboardMetrics({ desde: r.from, hasta: r.until, agrupacion: r.grouping })).toEqual(r);
    expect(f.rpc).toHaveBeenCalledOnce();
  });
});
