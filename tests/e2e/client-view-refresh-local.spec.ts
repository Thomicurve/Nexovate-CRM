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
      resolveId(id) { return ["next/link", "next/navigation"].includes(id) || (id.endsWith("/clientes/actions") || id.endsWith("/clientes/comment-actions")) ? `\0${id}` : undefined; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>window.crmHarness;";
        if (id === "\0next/link") return "import {createElement} from 'react'; export default function Link({prefetch,onNavigate,...props}){return createElement('a',props)}";
        if (id.endsWith("/clientes/comment-actions")) return "export async function loadClientComments(){return {kind:'found',rows:[],next:null,userId:'11111111-1111-4111-8111-111111111111'}} export async function createClientComment(){throw new Error('Comment writes disabled')} export const archiveClientComment=createClientComment;";
        if (id.endsWith("/clientes/actions")) return "export async function moveClient(){throw new Error('Business writes disabled in local harness')} export const saveClient=moveClient; export const deleteClient=moveClient;";
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (!["/clientes", "/dashboard"].includes(new URL(request.url!, "http://local.invalid").pathname)) return next();
        response.setHeader("Content-Type", "text/html");
        response.end(await vite.transformIndexHtml(request.url!, '<html lang="es"><head><style>body{padding:16px}@media(min-width:768px){body{padding:40px}}</style></head><body><div id="root"></div><script type="module" src="/tests/e2e/client-view-refresh-harness.tsx"></script></body></html>'));
      }); },
    }] });
  await server.listen();
  for (const path of ["/tests/e2e/client-view-refresh-harness.tsx", "/src/components/clients/client-list.tsx", "/src/components/clients/client-details.tsx",
    "/src/components/clients/client-comments.tsx", "/src/components/clients/clients.module.css", "/src/app/globals.css"])
    await server.transformRequest(path);
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
  await page.getByLabel("Buscar por nombre o empresa").fill("Nadie");
  const beforeFilter = reads.length;
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByText("No hay clientes que coincidan con los filtros.")).toBeVisible();
  expect(reads).toHaveLength(beforeFilter + 1);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("radio", { name: "Kanban", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Estado visible" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(writes).toEqual([]);
});

test("client reading and contextual filters reflow with native keyboard focus and safe return context", async ({ page }) => {
  test.setTimeout(90_000); // Cold Vite imports after a worker restart.
  const writes: string[] = [];
  const client = { ...confirmed, company: "Empresa " + "Extensa".repeat(15), rubro: "Servicios",
    email: "persona@example.com", phone: "+54 (11) 1234-5678", notes: "Notas de seguimiento.\n".repeat(25) };
  await page.route("**/__fixture**", async (route) => {
    const parsed = parseFilters(Object.fromEntries(new URL(route.request().url()).searchParams));
    if (!parsed.ok) throw new Error("Invalid local fixture query");
    await route.fulfill({ json: { kind: "found", filters: parsed.filters, rows: [client], count: 1 } });
  });
  page.on("request", (request) => { if (request.method() !== "GET") writes.push(request.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const context = "nombre=Empresa&estado=Contactado&desde=2026-10-07&hasta=2026-10-08&vista=tabla&orden=nombre&direccion=asc";
  await page.goto(`/clientes?${context}`);
  for (const width of [390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const search = page.getByRole("searchbox", { name: "Buscar por nombre o empresa" });
    await expect(search).toBeVisible(); await expect(search).toHaveValue("Empresa");
    await expect(page.getByText("1–1 de 1 clientes", { exact: true })).toBeVisible();
    const filters = page.getByRole("button", { name: "Filtros de clientes" });
    await filters.focus(); await page.keyboard.press("Enter");
    const panel = page.getByRole("region", { name: "Filtrar clientes" });
    await expect(panel).toBeVisible(); await expect(panel.getByRole("heading")).toBeFocused();
    await expect(page.getByRole("table", { name: "Clientes" })).toBeVisible();
    await expect(panel.getByLabel("Contacto desde")).toHaveValue("2026-10-07");
    await expect(panel.getByLabel("Ordenar por")).toHaveValue("nombre:asc");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape"); await expect(filters).toBeFocused();
    const opener = page.getByRole("button", { name: "Ver Confirmado" });
    await opener.focus(); await page.keyboard.press("Enter");
    const detail = page.getByRole("dialog", { name: "Confirmado", exact: true });
    await expect(detail.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
    for (const label of ["Empresa", "Rubro", "Estado", "Email", "Teléfono", "Contacto", "Reunión"]) {
      await expect(detail.locator("dt", { hasText: new RegExp(`^${label}$`) })).toHaveCount(1);
    }
    await expect(detail.getByRole("link", { name: "Enviar correo a Confirmado" })).toHaveAttribute("href", "mailto:persona%40example.com");
    await expect(detail.getByRole("link", { name: "Llamar a Confirmado" })).toHaveAttribute("href", "tel:+541112345678");
    const edit = detail.getByRole("link", { name: "Editar Confirmado" });
    expect(new URL(await edit.getAttribute("href") ?? "", page.url()).searchParams.get("returnTo")).toBe(`/clientes?${context}`);
    const box = await detail.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Shift+Tab"); await expect(detail.getByRole("textbox", { name: "Nuevo comentario" })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(detail.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("button", { name: "Ver Confirmado" }).click();
  await page.getByRole("link", { name: "Editar Confirmado" }).click();
  await expect(page.getByRole("dialog", { name: "Editar cliente" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver Confirmado" })).toBeFocused();
  await page.getByRole("link", { name: "Quitar estado Contactado" }).click();
  await expect(page.getByRole("link", { name: "Quitar estado Contactado" })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("nombre")).toBe("Empresa");
  expect(new URL(page.url()).searchParams.get("orden")).toBe("nombre");
  await page.getByRole("button", { name: "Filtros de clientes" }).click();
  await page.getByLabel("Ordenar por", { exact: true }).selectOption("reunion:asc");
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(/orden=reunion/);
  expect(new URL(page.url()).searchParams.get("orden")).toBe("reunion");
  expect(new URL(page.url()).searchParams.get("nombre")).toBe("Empresa");
  expect(new URL(page.url()).searchParams.has("pagina")).toBe(false);
  await expect(page.getByRole("table", { name: "Clientes" })).toBeVisible();
  expect(writes).toEqual([]);
});

test("empty states offer the correct recovery and invalid contact values remain text", async ({ page }) => {
  test.setTimeout(90_000); // Cold Vite imports after a worker restart.
  await page.route("**/__fixture**", async (route) => {
    const parsed = parseFilters(Object.fromEntries(new URL(route.request().url()).searchParams));
    if (!parsed.ok) throw new Error("Invalid local fixture query");
    const filters = parsed.filters;
    await route.fulfill({ json: filters.page > 1 ? { kind: "out_of_range", filters } : { kind: "found", filters,
      rows: filters.name === "Invalid" ? [{ ...confirmed, email: "bad\n@example.com", phone: "javascript:123456" }] : [],
      count: filters.name === "Invalid" ? 1 : 0 } });
  });
  await page.goto("/clientes?vista=tabla");
  await expect(page.getByText("Todavía no hay clientes.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crear primer cliente" })).toBeVisible();
  await page.getByRole("searchbox").fill("Nadie");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText("No hay clientes que coincidan con los filtros.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Limpiar filtros", exact: true }).last()).toBeVisible();
  await page.goto("/clientes?pagina=2&vista=tabla&orden=nombre&direccion=asc");
  await page.getByRole("link", { name: "Volver a la primera página" }).click();
  expect(new URL(page.url()).searchParams.get("orden")).toBe("nombre");
  expect(new URL(page.url()).searchParams.has("pagina")).toBe(false);
  await page.goto("/clientes?nombre=Invalid&vista=tabla");
  await page.getByRole("button", { name: "Ver Confirmado" }).click();
  const detail = page.getByRole("dialog", { name: "Confirmado", exact: true });
  await expect(detail.getByRole("link", { name: /Enviar correo|Llamar/ })).toHaveCount(0);
  await expect(detail.getByText("Sin cita", { exact: true })).toBeVisible();
});
