import { expect, test, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { bucketCount, METRIC_STATUSES, type MetricsData, type MetricsQuery, type MetricsResult } from "../../src/lib/metrics/model";
import { parseMetricsQuery, previousMetricsQuery } from "../../src/lib/metrics/query";
let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-dashboard", optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false,
    include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client", "recharts", "gsap", "@gsap/react"] },
    server: { host: "127.0.0.1", port: 3118, strictPort: true }, resolve: { alias: { "@": resolve("src") } }, plugins: [react(), {
      name: "local-dashboard-boundaries", enforce: "pre", resolveId(id) { if (["next/link", "next/navigation"].includes(id)) return `\0${id}`; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>window.metricsHarness;";
        if (id === "\0next/link") return "import {createElement} from 'react';export default function Link({prefetch,onNavigate,...props}){return createElement('a',props)}";
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (new URL(request.url!, "http://local.invalid").pathname !== "/dashboard") return next();
        response.setHeader("Content-Type", "text/html"); response.end(await vite.transformIndexHtml("/dashboard", '<html lang="es"><head><style>main{padding:40px}@media(max-width:600px){main{padding:20px}}</style></head><body><div id="root"></div><script type="module" src="/tests/e2e/dashboard-harness.tsx"></script></body></html>'));
      }); },
    }] }); await server.listen();
});
test.afterAll(async () => { await server?.close(); });
function fixture(query: MetricsQuery): MetricsData {
  const size = bucketCount(query);
  if (size > 2000) return { kind: "too_many_buckets", ...query, bucketCount: size,
    metrics: METRIC_STATUSES.map((status) => ({ status, historicalTotal: 10000, rangeTotal: 12 })) };
  const date = new Date(`${query.from}T00:00:00Z`);
  if (query.grouping !== "day") date.setUTCDate(1); if (query.grouping === "year") date.setUTCMonth(0);
  const starts = Array.from({ length: size }, () => {
    const start = date.toISOString().slice(0, 10);
    if (query.grouping === "day") date.setUTCDate(date.getUTCDate() + 1);
    else if (query.grouping === "month") date.setUTCMonth(date.getUTCMonth() + 1); else date.setUTCFullYear(date.getUTCFullYear() + 1);
    return start;
  });
  return { kind: "ready", ...query, metrics: METRIC_STATUSES.map((status, index) => {
    const buckets = starts.map((start, i) => ({ start, count: i % 3 === 1 ? [6, 2, 1][index] : 0 }));
    return { status, historicalTotal: 10000, rangeTotal: buckets.reduce((sum, b) => sum + b.count, 0), buckets };
  }) };
}
async function boundaries(page: Page) {
  let mode: "ready" | "previous-unavailable" | "zero" | "unavailable" = "ready";
  const reads: string[] = [], forbidden: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3118" || request.method() !== "GET") { forbidden.push(request.url()); await route.abort(); return; }
    if (url.pathname !== "/__fixture") { await route.continue(); return; }
    reads.push(url.search); const parsed = parseMetricsQuery(Object.fromEntries(url.searchParams), new Date("2026-10-11T02:00:00Z"));
    let result: MetricsResult;
    if (!parsed.ok) result = { kind: "invalid", message: parsed.message };
    else if (mode === "unavailable") result = { kind: "unavailable", query: parsed.query };
    else {
      const previous = previousMetricsQuery(parsed.query);
      result = { ...fixture(parsed.query), comparison: previous && mode !== "previous-unavailable" ? { kind: "ready", query: previous,
        metrics: METRIC_STATUSES.map((status) => ({ status, historicalTotal: 10000, rangeTotal: mode === "zero" ? 0 : 2 })) } : { kind: "unavailable", query: previous } };
    }
    await route.fulfill({ json: result });
  });
  return { reads, forbidden, mode: (next: typeof mode) => { mode = next; } };
}
test("combined linear areas, native keyboard table and reflow keep all three series readable", async ({ page }) => {
  const data = await boundaries(page); await page.goto("/dashboard?desde=2026-10-07&hasta=2026-10-09&agrupacion=day");
  const chart = page.locator('.recharts-surface[role="application"]'); await expect(chart).toBeVisible();
  const settledGeometry = async () => {
    // ResponsiveContainer updates SVG dimensions from an asynchronous ResizeObserver.
    await expect.poll(() => chart.evaluate((svg) => Math.abs(svg.getBoundingClientRect().width - svg.closest(".recharts-responsive-container")!.getBoundingClientRect().width))).toBeLessThan(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  await settledGeometry();
  await expect(page.getByRole("region", { name: "Contactados", exact: true }).getByLabel("Contactados en el rango seleccionado")).toHaveText("6");
  await expect(page.getByText(/Comparación anterior: 04\/10\/2026 a 06\/10\/2026/)).toBeVisible();
  const curves = page.locator(".recharts-area-curve"); await expect(curves).toHaveCount(3);
  expect(await curves.evaluateAll((lines) => lines.map((line) => ({ stroke: line.getAttribute("stroke"), dash: line.getAttribute("stroke-dasharray"), width: line.getAttribute("stroke-width") })))).toEqual([
    { stroke: "#2D78FF", dash: null, width: "2.5" }, { stroke: "#79AAFF", dash: "8 5", width: "2.5" }, { stroke: "#B5D3FF", dash: "2 5", width: "2.5" }]);
  for (const line of await curves.all()) expect(await line.getAttribute("d")).not.toMatch(/[CQ]/);
  const fills = page.locator(".recharts-area-area"); await expect(fills).toHaveCount(3);
  const bases = await fills.evaluateAll((areas) => areas.map((area) => {
    const points = [...area.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)];
    return points.slice(-2).map((point) => Number(point[2]));
  }));
  expect(bases[0]).toEqual(bases[1]); expect(bases[1]).toEqual(bases[2]);
  const peaks = await curves.evaluateAll((lines) => lines.map((line) => Math.min(...[...line.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((point) => Number(point[2])))));
  // Independent 6/2/1 series peaks descend from the shared zero baseline; stacking would reverse this order.
  expect(peaks[0]).toBeLessThan(peaks[1]); expect(peaks[1]).toBeLessThan(peaks[2]);
  expect(await fills.evaluateAll((areas) => areas.map((area) => area.getAttribute("fill-opacity")))).toEqual(["0.24", "0.18", "0.12"]);
  await expect(page.locator(".recharts-area-dot, .recharts-active-dot")).toHaveCount(0); await expect(page.getByText("Cantidad", { exact: true })).toBeVisible();
  await chart.focus(); await page.keyboard.press("ArrowRight"); await expect(page.locator(".recharts-tooltip-wrapper")).toBeVisible();
  const summary = page.getByText("Ver datos por período", { exact: true }); await summary.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("table", { name: "Hitos por período" }).locator("tbody tr")).toHaveCount(3);
  for (const width of [390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await settledGeometry();
    expect((await chart.boundingBox())!.width).toBeGreaterThan(width === 390 ? 260 : 400);
    for (const label of ["Últimos siete días", "Mes actual", "Mes anterior", "Aplicar rango"]) {
      const button = page.getByRole("button", { name: label }); expect(Math.round((await button.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    }
  }
  await page.setViewportSize({ width: 390, height: 450 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await settledGeometry();
  expect(data.forbidden).toEqual([]);
});
test("draft dates/group and three presets apply together while applied state tracks data", async ({ page }) => {
  const data = await boundaries(page); await page.goto("/dashboard?desde=2026-10-07&hasta=2026-10-09&agrupacion=day");
  const original = page.url(); await page.getByLabel("Desde", { exact: true }).fill("2026-09-01");
  await page.getByRole("button", { name: "Mes", exact: true }).click(); await expect(page).toHaveURL(original);
  await expect(page.getByLabel("Desde", { exact: true })).toHaveValue("2026-09-01");
  await expect(page.getByText(/Período aplicado:/)).toContainText("Agrupación: Día");
  await page.getByRole("button", { name: "Aplicar rango" }).focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/desde=2026-09-01&hasta=2026-10-09&agrupacion=month/);
  await expect(page.getByText(/Período aplicado:/)).toContainText("Agrupación: Mes");
  for (const label of ["Últimos siete días", "Mes actual", "Mes anterior"]) {
    const before = page.url(); await page.getByRole("button", { name: label }).click(); await expect(page).toHaveURL(before);
    const from = await page.getByLabel("Desde", { exact: true }).inputValue(), until = await page.getByLabel("Hasta", { exact: true }).inputValue();
    await page.getByRole("button", { name: "Aplicar rango" }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:3118/dashboard?desde=${from}&hasta=${until}&agrupacion=month`);
  }
  expect(data.forbidden).toEqual([]);
});
test("comparison unknown/zero and failed refresh retain honest current totals", async ({ page }) => {
  const data = await boundaries(page); data.mode("previous-unavailable"); await page.goto("/dashboard?desde=2026-10-07&hasta=2026-10-09&agrupacion=day");
  const metric = page.getByRole("region", { name: "Contactados", exact: true }); await expect(metric).toContainText("Comparación no disponible");
  expect(await metric.textContent()).not.toContain("%"); data.mode("zero"); await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(metric).toContainText("base anterior: 0"); expect(await metric.textContent()).not.toContain("%");
  data.mode("unavailable"); await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Se conservan los últimos datos"); await expect(metric.getByLabel("Contactados en el rango seleccionado")).toHaveText("6");
  expect(data.forbidden).toEqual([]);
});
test("2000 real periods remain complete and excessive ranges keep totals without massive rendering", async ({ page }) => {
  const data = await boundaries(page); const until = new Date(Date.UTC(2020, 0, 2000)).toISOString().slice(0, 10);
  await page.goto(`/dashboard?desde=2020-01-01&hasta=${until}&agrupacion=day`);
  await expect(page.locator(".recharts-area-curve")).toHaveCount(3); await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByText("Ver datos por período", { exact: true }).click(); await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(2000);
  const tableRegion = page.getByRole("region", { name: "Tabla de hitos desplazable" });
  expect(await tableRegion.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await tableRegion.focus(); await page.keyboard.press("End");
  await page.goto("/dashboard?desde=1900-01-01&hasta=9999-12-31&agrupacion=year");
  await expect(page.getByRole("status")).toContainText("Los totales están completos"); await expect(page.locator(".recharts-area-curve")).toHaveCount(0);
  await expect(page.getByText(/el período anterior queda fuera/)).toBeVisible();
  await expect(page.getByLabel("Contactados en el rango seleccionado")).toHaveText("12"); expect(data.forbidden).toEqual([]);
});
test("invalid URL preserves entered bounds without claiming an applied period or zero totals", async ({ page }) => {
  const data = await boundaries(page); await page.goto("/dashboard?desde=2026-10-09&hasta=2026-10-07&agrupacion=day");
  await expect(page.getByRole("alert")).toContainText("Revisá el rango");
  await expect(page.getByLabel("Desde", { exact: true })).toHaveValue("2026-10-09");
  await expect(page.getByLabel("Hasta", { exact: true })).toHaveValue("2026-10-07");
  await expect(page.getByText(/^Período aplicado:/)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Contactados", exact: true })).toHaveCount(0);
  expect(data.forbidden).toEqual([]);
});
