import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { runKanbanLiveFlow } from "./kanban-live-flow";
import { isClient, type Client } from "../../src/lib/clients/model";
import { decodeMetrics, type MetricsQuery, type MetricsData } from "../../src/lib/metrics/model";

// PREPARED ONLY: needs fresh human authority for both this run and its exact cleanup.
// Shared harness owns two maximum fixtures, provenance, recovery, locks and sign-outs.
export async function runDashboardLiveFlow({ page, users, actorIds, fixtures, request, remember, current }: Parameters<typeof runKanbanLiveFlow>[0]) {
  let pending: { actorId: string; p_request_id: string; p_client_id: string; p_expected_version: number; p_payload: Record<string, string> } | undefined;
  const update = async (actorIndex: number, row: Client, payload: Record<string, string>) => {
    const params = Object.freeze({ p_request_id: request(actorIndex, randomUUID(), row.id), p_client_id: row.id,
      p_expected_version: row.version, p_payload: Object.freeze({ ...payload }) });
    pending = { actorId: actorIds[actorIndex], ...params }; // Complete frozen intent is retained before any SDK write.
    const response = await users[actorIndex].rpc("update_client", params);
    expect(response.error === null && isClient(response.data)).toBe(true);
    remember(response.data);
    const confirmed = await current(row.id);
    expect(confirmed.version).toBe(row.version + 1);
    expect(confirmed).toEqual(response.data);
    pending = undefined;
    return confirmed;
  };
  const readMetrics = async (query: MetricsQuery): Promise<MetricsData> => {
    const response = await users[0].rpc("dashboard_metrics", { p_from: query.from, p_until: query.until, p_grouping: query.grouping });
    expect(response.error).toBeNull();
    const decoded = decodeMetrics(response.data, query); expect(decoded).not.toBeNull();
    const partner = await users[1].rpc("dashboard_metrics", { p_from: query.from, p_until: query.until, p_grouping: query.grouping });
    expect(partner.error).toBeNull(); expect(partner.data).toEqual(response.data);
    return decoded!;
  };
  try {
    let owner = [...fixtures.values()].find((row) => row.status === "Cerrado")!;
    let partner = [...fixtures.values()].find((row) => row.status === "Contactado")!;
    expect(Boolean(owner && partner && owner.id !== partner.id && fixtures.size === 2)).toBe(true);
    const all: MetricsQuery = { from: "1900-01-01", until: "9999-12-31", grouping: "year" };
    const initial = await readMetrics(all);
    expect(initial.metrics.map((m) => m.historicalTotal)).toEqual([2, 1, 1]);
    expect(initial.kind).toBe("too_many_buckets");
    owner = await update(0, owner, { status: "Interesado" });
    owner = await update(1, owner, { status: "Reunión agendada" });
    owner = await update(0, owner, { status: "Cerrado" });
    const returned = await readMetrics(all); expect(returned.metrics).toEqual(initial.metrics);
    owner = await update(0, owner, { contact_at: "2025-12-31T03:00:00Z", meeting_at: "2099-12-01T12:00:00Z" });
    partner = await update(1, partner, { contact_at: "2026-01-01T03:00:00Z", status: "Cerrado" });
    const moved = await readMetrics(all); expect(moved.metrics.map((m) => m.historicalTotal)).toEqual([2, 1, 2]);
    const dates: MetricsQuery = { from: "2025-12-31", until: "2026-01-02", grouping: "day" };
    const before = await readMetrics(dates); expect(before.kind).toBe("ready");
    if (before.kind !== "ready") throw new Error("Series unexpectedly absent");
    expect(before.metrics[0].buckets.map((b) => b.count)).toEqual([1, 1, 0]);
    owner = await update(0, owner, { contact_at: "2026-01-02T03:00:00Z", meeting_at: "2100-01-01T12:00:00Z" });
    const after = await readMetrics(dates); if (after.kind !== "ready") throw new Error("Series unexpectedly absent");
    expect(after.metrics[0].buckets.map((b) => b.count)).toEqual([0, 1, 1]);
    expect(after.metrics[1]).toEqual(before.metrics[1]); expect(after.metrics[2]).toEqual(before.metrics[2]);
    for (const grouping of ["day", "month", "year"] as const) {
      const query = new URLSearchParams({ desde: dates.from, hasta: dates.until, agrupacion: grouping });
      await page.goto(`/dashboard?${query}`);
      const metric = page.getByRole("region", { name: "Contactados", exact: true });
      await expect(metric.getByLabel("Contactados en el rango seleccionado")).toHaveText("2");
      await expect(metric.getByText("2 históricos", { exact: true })).toBeVisible();
      const chart = metric.locator('.recharts-surface[role="application"]'); await expect(chart).toBeVisible();
      await chart.focus(); await page.keyboard.press("ArrowRight"); await expect(metric.locator(".recharts-tooltip-wrapper")).toBeVisible();
      await metric.getByText("Ver datos por período", { exact: true }).focus(); await page.keyboard.press("Enter");
      await expect(metric.getByRole("table").locator("tbody tr")).toHaveCount(grouping === "day" ? 3 : 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto("/dashboard?desde=2026-01-01&hasta=2026-01-02&agrupacion=day");
    await page.setViewportSize({ width: 390, height: 1000 });
    for (const title of ["Contactados", "Reuniones agendadas", "Cerrados"]) {
      const metric = page.getByRole("region", { name: title, exact: true });
      expect((await metric.boundingBox())?.width).toBeCloseTo(358, 0);
      expect((await metric.locator(".recharts-responsive-container").boundingBox())?.height).toBe(124);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/dashboard?desde=1900-01-01&hasta=9999-12-31&agrupacion=year");
    await expect(page.getByRole("status")).toContainText("Reducí el rango");
    await expect(page.getByText("2 históricos", { exact: true })).toHaveCount(2);
    await expect(page.locator(".recharts-surface")).toHaveCount(0);
    await page.goto("/dashboard?desde=1900-01-01&hasta=1900-01-02&agrupacion=day");
    await expect(page.getByText("No hay nuevos hitos en estas fechas", { exact: true })).toBeVisible();
    await expect(page.getByText("2 históricos", { exact: true })).toHaveCount(2);
    await page.getByRole("button", { name: "Cambiar rango" }).click(); await expect(page.getByLabel("Desde", { exact: true })).toBeFocused();
    console.log("Dashboard TASK007: confirmed first milestones, return/skip/correction, two-member totals, day/month/year SVG keyboard/table and responsive layout.");
  } catch (error) {
    // Unknown outcome remains unknown; helper rejects missing ledger rather than deleting uncertain data.
    if (pending) console.log("Dashboard pending fixture intent:", JSON.stringify(pending));
    throw error;
  }
}
