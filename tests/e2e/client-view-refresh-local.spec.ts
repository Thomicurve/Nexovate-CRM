import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { parseFilters } from "../../src/lib/clients/filters";
import { METRIC_STATUSES } from "../../src/lib/metrics/model";
import { confirmed } from "../clients/fixture";

// Real React components, local HTTP fixtures and History API. No Next RSC/provider claim.
let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-view-refresh", optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false, include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client", "motion/react", "@dnd-kit/core", "recharts", "use-sync-external-store/shim/with-selector"] }, server: { host: "127.0.0.1", port: 3111, strictPort: true },
    resolve: { alias: { "@": resolve("src") } }, plugins: [react(), {
      name: "local-crm-boundaries", enforce: "pre",
      resolveId(id) { return ["next/link", "next/navigation"].includes(id) || id.endsWith("/clientes/actions") ? `\0${id}` : undefined; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>window.crmHarness;";
        if (id === "\0next/link") return "import {createElement} from 'react'; export default function Link({prefetch,onNavigate,...props}){return createElement('a',props)}";
        if (id.endsWith("/clientes/actions")) return "export async function moveClient(){throw new Error('Business writes disabled in local harness')} export const saveClient=moveClient; export const deleteClient=moveClient;";
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (!["/clientes", "/dashboard"].includes(new URL(request.url!, "http://local.invalid").pathname)) return next();
        response.setHeader("Content-Type", "text/html");
        response.end(await vite.transformIndexHtml(request.url!, '<html lang="es"><body style="padding:24px"><div id="root"></div><script type="module" src="/tests/e2e/client-view-refresh-harness.tsx"></script></body></html>'));
      }); },
    }] });
  await server.listen();
});
test.afterAll(async () => { await server?.close(); });

test("local components preserve filtered page through view/history/reload and both refresh failures", async ({ page }) => {
  test.setTimeout(90_000); // Cold local Vite bundling; product assertions keep their existing limits.
  const reads: string[] = [], writes: string[] = [];
  let fail = false, finish: (() => void) | undefined;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") { writes.push(request.url()); await route.abort(); return; }
    if (!new URL(request.url()).pathname.startsWith("/__fixture")) return route.continue();
    reads.push(request.url());
    const query = new URL(request.url()).searchParams, params = Object.fromEntries(query);
    const failed = fail; fail = false;
    if (failed) await new Promise<void>((resolve) => { finish = resolve; });
    const parsed = parseFilters(page.url().includes("/dashboard") ? {} : params); if (!parsed.ok) throw new Error("Invalid local test filters");
    const result = page.url().includes("/dashboard") ? failed ? { kind: "unavailable", query: { from: params.desde, until: params.hasta, grouping: params.agrupacion } } :
      { kind: "ready", from: params.desde, until: params.hasta, grouping: params.agrupacion,
        metrics: METRIC_STATUSES.map((status) => ({ status, historicalTotal: 12, rangeTotal: 3, buckets: [{ start: params.desde, count: 3 }] })) } :
      failed ? { kind: "unavailable", filters: parsed.filters } : { kind: "found", filters: parsed.filters, count: params.nombre === "Nadie" ? 0 : 101,
        rows: params.nombre === "Nadie" ? [] : [confirmed] };
    await route.fulfill({ json: result });
  });
  await page.goto("/clientes?nombre=Confirmado&estado=Contactado&pagina=2&vista=tabla");
  await expect(page.getByRole("table", { name: "Clientes" })).toContainText("Confirmado");
  const baseline = reads.length;
  await page.getByRole("radio", { name: "Kanban", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Kanban de clientes" })).toBeVisible();
  await page.getByRole("radio", { name: "Tabla", exact: true }).click();
  await page.goBack(); await expect(page.getByRole("region", { name: "Kanban de clientes" })).toBeVisible();
  await page.goForward(); await expect(page.getByRole("table")).toContainText("Confirmado");
  expect(reads).toHaveLength(baseline);
  await expect(page.getByText("Página 2 · 101 clientes")).toBeVisible();
  await page.reload(); await expect(page.getByRole("table")).toContainText("Confirmado");
  for (const destination of ["clientes", "dashboard"]) {
    if (destination === "dashboard") await page.goto("/dashboard?desde=2026-10-01&hasta=2026-10-08&agrupacion=month");
    const contents = destination === "clientes" ? page.getByRole("table") : page.getByRole("region", { name: "Contactados", exact: true });
    await expect(contents).toBeVisible();
    const url = page.url(), text = await contents.textContent(), before = reads.length;
    fail = true;
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Cargando" })).toBeVisible();
    const updating = page.getByRole("button", { name: "Actualizando…", exact: true });
    await expect(updating).toBeDisabled();
    await updating.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect.poll(() => reads.length).toBe(before + 1);
    finish!();
    await expect(page.getByRole("alert")).toHaveText(/No pudimos actualizar/);
    expect(await contents.textContent()).toBe(text); await expect(page).toHaveURL(url);
    await page.getByRole("button", { name: "Reintentar actualización", exact: true }).click();
    await expect(page.getByRole("button", { name: "Actualizar", exact: true })).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(reads).toHaveLength(before + 2); await expect(page).toHaveURL(url);
  }
  await page.goto("/clientes?vista=tabla");
  const beforePage = reads.length;
  await page.getByRole("link", { name: "Siguiente", exact: true }).click();
  await expect(page.getByText("Página 2 · 101 clientes")).toBeVisible();
  expect(reads).toHaveLength(beforePage + 1);
  await page.getByRole("button", { name: "Filtros de clientes" }).click();
  await page.getByLabel("Nombre").fill("Nadie");
  const beforeFilter = reads.length;
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByText("No hay clientes que coincidan con los filtros.")).toBeVisible();
  expect(reads).toHaveLength(beforeFilter + 1);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("radio", { name: "Kanban", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Estado visible" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(writes).toEqual([]);
});
