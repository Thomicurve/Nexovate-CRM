import { expect, test, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { parseFilters } from "../../src/lib/clients/filters";
import { UUID, type Client } from "../../src/lib/clients/model";
import type { MoveIntent } from "../../src/lib/clients/moves";
import { KANBAN_STATUSES } from "../../src/lib/clients/column-order";
import { confirmed } from "../clients/fixture";

const storageKey = "crm:kanban-column-order:v1";
let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-crm-modal",
    optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false, include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client", "motion/react", "@dnd-kit/core"] },
    server: { host: "127.0.0.1", port: 3113, strictPort: true }, resolve: { alias: { "@": resolve("src") } }, plugins: [react(), {
      name: "local-modal-boundaries", enforce: "pre",
      resolveId(id) { return ["next/link", "next/navigation"].includes(id) || id.endsWith("/clientes/actions") ? `\0${id}` : undefined; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>window.crmHarness;";
        if (id === "\0next/link") return "import {createElement} from 'react'; export default function Link({prefetch,onNavigate,...props}){return createElement('a',props)}";
        if (id.endsWith("/clientes/actions")) return "export const moveClient=async intent=>(await fetch('/__move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(intent)})).json(); export async function saveClient(){throw new Error('Saves disabled in kanban harness')} export const deleteClient=saveClient;";
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (new URL(request.url!, "http://local.invalid").pathname !== "/clientes") return next();
        try {
          response.setHeader("Content-Type", "text/html");
          response.end(await vite.transformIndexHtml(request.url!, '<html lang="es"><head><style>body{padding:16px}@media(min-width:769px){body{padding:40px}}</style></head><body><div id="root"></div><script type="module" src="/tests/e2e/client-modal-harness.tsx"></script></body></html>'));
        } catch (error) { next(error); }
      }); },
    }] }); await server.listen();
  // Prepare source transforms before browser startup; interaction assertions retain their own limits.
  for (const path of ["/tests/e2e/client-modal-harness.tsx", "/src/components/clients/client-list.tsx", "/src/components/clients/client-kanban.tsx", "/src/components/clients/client-form.tsx", "/src/components/clients/clients.module.css", "/src/components/ui/notifications.module.css", "/src/lib/clients/filters.ts", "/src/app/globals.css"]) await server.transformRequest(path);
});
test.afterAll(async () => { await server?.close(); });

async function fixtures(page: Page) {
  let client: Client = { ...confirmed, email: "persona@example.com", notes: "Datos completos" }, uncertain = false;
  const moves: MoveIntent[] = [], reads: string[] = [], forbidden: string[] = [], errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3113" || request.method() !== "GET" && url.pathname !== "/__move") {
      forbidden.push(request.url()); await route.abort(); return;
    }
    if (url.pathname === "/__fixture") {
      reads.push(request.url()); const parsed = parseFilters(Object.fromEntries(url.searchParams));
      if (!parsed.ok) throw new Error("Invalid fixture filters");
      const extra = Array.from({ length: 4 }, (_, index) => ({ ...confirmed, id: `22222222-2222-4222-8222-22222222222${index}`, name: `Cliente scroll ${index}` }));
      await route.fulfill({ json: { kind: "found", filters: parsed.filters, rows: [client, ...extra], count: 5 } }); return;
    }
    if (url.pathname === "/__move") {
      const intent = request.postDataJSON() as MoveIntent;
      expect(Object.keys(intent).sort()).toEqual(["clientId", "from", "requestId", "to", "version"]);
      expect(intent.clientId).toBe(client.id); expect(UUID.test(intent.requestId)).toBe(true); expect(KANBAN_STATUSES).toContain(intent.to);
      expect(intent.version).toBe(client.version); expect(intent.from).toBe(client.status); moves.push(intent);
      if (uncertain) { await route.fulfill({ json: { kind: "error", retry: true, message: "Movimiento sin confirmar" } }); return; }
      client = { ...client, status: intent.to, version: client.version + 1 };
      await route.fulfill({ json: { kind: "success", client } }); return;
    }
    await route.continue();
  });
  return { moves, reads, forbidden, errors, uncertain: (next: boolean) => { uncertain = next; } };
}
const headings = (page: Page) => page.getByRole("region", { name: "Kanban de clientes" }).getByRole("heading", { level: 2 });
const card = (page: Page) => page.locator(`[data-client="${confirmed.id}"]`);
async function pointerDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, cancel = false) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y, { steps: 3 }); await page.mouse.move(to.x, to.y, { steps: 10 });
  if (cancel) await page.keyboard.press("Escape"); await page.mouse.up();
}

test("cards open editable data while drag, cancel, selection and modifiers preserve move intentions", async ({ page }) => {
  test.setTimeout(90_000); const data = await fixtures(page); await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto("/clientes?nombre=Confirmado", { waitUntil: "commit" });
  await page.waitForLoadState("load"); const open = card(page).getByRole("button", { name: "Abrir Confirmado" });
  await expect(open).toBeVisible(); expect(await card(page).getByText("Editar", { exact: true }).count()).toBe(0);
  expect(await card(page).getByText("Cambiar estado", { exact: true }).count()).toBe(0);
  const baseline = data.reads.length, url = page.url();
  for (const keyboard of [false, true]) {
    if (keyboard) { await open.focus(); await page.keyboard.press("Space"); } else await open.click();
    await expect(page.getByRole("dialog", { name: "Editar cliente" })).toBeVisible();
    await expect(page.getByLabel("Notas")).toHaveValue("Datos completos");
    await expect(page.getByLabel("Email")).toHaveValue("persona@example.com");
    await page.getByRole("button", { name: "Cancelar" }).click(); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(open).toBeFocused();
  }
  expect(data.reads).toHaveLength(baseline); await expect(page).toHaveURL(url);
  await open.click({ modifiers: ["Control"] }); await open.click({ button: "middle" });
  await card(page).getByText(/^Contacto:/).evaluate((element) => { const range = document.createRange(); range.selectNodeContents(element); getSelection()!.addRange(range); });
  await open.click(); await expect(page.getByRole("dialog")).toHaveCount(0); await page.evaluate(() => getSelection()!.removeAllRanges());
  const body = await card(page).getByText(/^Contacto:/).boundingBox(), target = await page.locator('[data-column="Interesado"]').boundingBox();
  await pointerDrag(page, { x: body!.x + 20, y: body!.y + 5 }, { x: target!.x + 100, y: target!.y + 100 }, true);
  await expect(page.getByRole("dialog")).toHaveCount(0); expect(data.moves).toHaveLength(0);
  const handle = card(page).getByRole("button", { name: "Arrastrar cliente Confirmado" });
  await handle.focus(); await page.keyboard.press("Space"); await page.keyboard.press("ArrowRight"); await expect(page.getByText("Soltar aquí")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(handle).toBeFocused(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await pointerDrag(page, { x: body!.x + 20, y: body!.y + 5 }, { x: target!.x + 100, y: target!.y + 100 });
  await expect(page.getByText("Estado actualizado", { exact: true })).toBeVisible(); expect(data.moves[0].to).toBe("Interesado");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  data.uncertain(true); await handle.focus(); await page.keyboard.press("Space"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Space");
  await expect(page.getByRole("alert")).toHaveText("Movimiento sin confirmar");
  await expect(open).toBeDisabled(); await expect(page.getByRole("button", { name: "Arrastrar columna Contactado" })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Tabla", exact: true })).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  data.uncertain(false); await page.getByRole("button", { name: "Intentar de nuevo" }).click();
  await expect(open).toHaveAttribute("aria-disabled", "false"); expect(data.moves[2]).toEqual(data.moves[1]);
  expect(data.forbidden).toEqual([]); expect(data.errors).toEqual([]);
});

test("column header pointer and keyboard reorder persist without querying, corrupt preferences normalize", async ({ page }) => {
  test.setTimeout(90_000); const data = await fixtures(page); await page.setViewportSize({ width: 1920, height: 1000 }); await page.goto("/clientes");
  const from = await page.getByRole("button", { name: "Arrastrar columna Cerrado" }).boundingBox(), to = await page.locator('[data-column="Contactado"]').boundingBox();
  const baseline = data.reads.length;
  await pointerDrag(page, { x: from!.x + 22, y: from!.y + 22 }, { x: to!.x + 100, y: to!.y + 30 });
  const first = ["Cerrado", "Contactado", "Interesado", "Reunión agendada", "Sin respuesta", "Respuesta negativa"];
  await expect(headings(page)).toHaveText(first);
  const handle = page.getByRole("button", { name: "Arrastrar columna Interesado" }); await handle.focus();
  await page.keyboard.press("Space"); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("Space");
  const next = ["Cerrado", "Interesado", "Contactado", "Reunión agendada", "Sin respuesta", "Respuesta negativa"];
  await expect(headings(page)).toHaveText(next); expect(data.reads).toHaveLength(baseline); expect(data.moves).toEqual([]);
  await handle.focus(); await page.keyboard.press("Space"); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("Escape");
  await expect(headings(page)).toHaveText(next); await expect(handle).toBeFocused();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual(next);
  await page.reload(); await expect(headings(page)).toHaveText(next);
  const corrupt = '["Sin respuesta","unknown","Sin respuesta"]'; await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: corrupt });
  await page.reload(); await expect(headings(page)).toHaveText(["Sin respuesta", ...KANBAN_STATUSES.filter((status) => status !== "Sin respuesta")]);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(corrupt);
  expect(data.forbidden).toEqual([]); expect(data.errors).toEqual([]);
});

test("mobile touch scrolling does not open cards; menu and keyboard destinations follow custom order", async ({ page, context }) => {
  test.setTimeout(90_000); const data = await fixtures(page); await page.setViewportSize({ width: 390, height: 700 });
  const order = ["Cerrado", "Contactado", "Sin respuesta", "Interesado", "Reunión agendada", "Respuesta negativa"];
  await page.addInitScript(({ key, order }) => localStorage.setItem(key, JSON.stringify(order)), { key: storageKey, order });
  await page.goto("/clientes"); const visible = page.getByRole("radiogroup", { name: "Estado visible" });
  await expect(visible.getByRole("radio", { name: /^Contactado,/ })).toHaveAttribute("aria-checked", "true"); expect(await visible.getByRole("radio").evaluateAll((options) => options.map((option) => option.getAttribute("aria-label")?.split(",")[0]))).toEqual(order);
  await visible.getByRole("radio", { name: /^Contactado,/ }).click(); const open = card(page).getByRole("button", { name: "Abrir Confirmado" });
  await open.tap(); await expect(page.getByRole("dialog")).toBeVisible(); await page.getByRole("button", { name: "Cancelar" }).tap(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await open.scrollIntoViewIfNeeded(); const box = await open.boundingBox(), before = await page.evaluate(() => scrollY);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box!.x + 80, y: box!.y + 80 }] });
  for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box!.x + 80, y: box!.y + 80 - step * 18 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cdp.detach();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before); await expect(page.getByRole("dialog")).toHaveCount(0); expect(data.moves).toEqual([]);
  const handle = card(page).getByRole("button", { name: "Arrastrar cliente Confirmado" }); await handle.focus();
  expect((await handle.boundingBox())!.width).toBe(44); expect((await handle.boundingBox())!.height).toBe(44);
  await page.keyboard.press("Space"); await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight"); await expect(visible.getByRole("radio", { name: /^Sin respuesta,/ })).toHaveAttribute("aria-checked", "true"); await page.keyboard.press("Space");
  await expect(page.getByText("Estado actualizado", { exact: true })).toBeVisible(); expect(data.moves[0].to).toBe("Sin respuesta");
  const menu = page.getByRole("button", { name: "Ordenar etapa Sin respuesta" }); await menu.click();
  await page.getByRole("menuitem", { name: "Mover a la izquierda", exact: true }).click();
  const next = ["Cerrado", "Sin respuesta", "Contactado", "Interesado", "Reunión agendada", "Respuesta negativa"];
  expect(await visible.getByRole("radio").evaluateAll((options) => options.map((option) => option.getAttribute("aria-label")?.split(",")[0]))).toEqual(next);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual(next);
  await menu.click(); await page.getByRole("menuitem", { name: "Mover a la derecha", exact: true }).focus(); await page.keyboard.press("Escape"); await expect(menu).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(data.forbidden).toEqual([]); expect(data.errors).toEqual([]);
});

test("denied browser storage falls back to six columns and still permits ordering", async ({ page }) => {
  test.setTimeout(90_000); const data = await fixtures(page); await page.setViewportSize({ width: 1920, height: 1000 });
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Denied", "SecurityError"); } }); });
  await page.goto("/clientes"); await expect(headings(page)).toHaveText([...KANBAN_STATUSES]);
  await page.getByRole("button", { name: "Arrastrar columna Interesado" }).focus(); await page.keyboard.press("Space"); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("Space");
  await expect(headings(page)).toHaveText(["Interesado", "Contactado", ...KANBAN_STATUSES.slice(2)]);
  expect(data.moves).toEqual([]); expect(data.forbidden).toEqual([]); expect(data.errors).toEqual([]);
});

test("stage selection, card variants and desktop menus remain usable across supported widths", async ({ page }) => {
  test.setTimeout(90_000);
  const longName = "Cliente " + "Extenso".repeat(18), company = "Empresa " + "Larga".repeat(25);
  const writes: string[] = [], rows = [
    { ...confirmed, name: longName, status: "Interesado", company, rubro: "Servicios", email: "persona@example.com",
      phone: "123456789", notes: "Seguimiento", meeting_at: "2026-10-08T15:30:00Z" },
    { ...confirmed, id: "33333333-3333-4333-8333-333333333333", name: "Sin opcionales", status: "Interesado" },
    { ...confirmed, id: "44444444-4444-4444-8444-444444444444", name: "Sin reunión", status: "Sin respuesta", company: "Otra empresa" },
  ];
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET") { writes.push(url.href); await route.abort(); return; }
    if (url.pathname !== "/__fixture") return route.continue();
    const parsed = parseFilters({}); if (!parsed.ok) throw new Error("Invalid local filters");
    await route.fulfill({ json: { kind: "found", filters: parsed.filters, rows, count: rows.length } });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 900 }); await page.goto("/clientes");
  const stages = page.getByRole("radiogroup", { name: "Estado visible" });
  await expect(stages.getByRole("radio", { name: "Interesado, 2 clientes" })).toHaveAttribute("aria-checked", "true");
  const measuredCounts: number[] = [];
  for (const width of [390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width <= 768) {
      await expect(stages.getByRole("radio")).toHaveCount(6);
      const options = await stages.getByRole("radio").evaluateAll((buttons) => buttons.map((button) => {
        const box = button.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height };
      }));
      expect(new Set(options.map((box) => box.y)).size).toBe(3);
      expect(options.every((box) => box.height >= 64 && box.x >= 0 && box.x + box.width <= width)).toBe(true);
    }
    const full = card(page).getByRole("button", { name: `Abrir ${longName}` });
    await expect(full.getByText(company, { exact: true })).toBeVisible();
    await expect(full.getByText(/^Contacto:/)).toBeVisible(); await expect(full.getByText(/^Reunión:/)).toBeVisible();
    for (const label of ["Servicios", "Notas", "Email", "Teléfono"]) await expect(full.getByText(label, { exact: true })).toBeVisible();
    const incomplete = page.getByRole("button", { name: "Abrir Sin opcionales" });
    await expect(incomplete.getByText(/Sin empresa|Sin informar|Reunión:|Notas|Email|Teléfono/)).toHaveCount(0);
    const menu = page.getByRole("button", { name: "Ordenar etapa Interesado" });
    await menu.scrollIntoViewIfNeeded(); await menu.focus();
    const tooltip = menu.getByText("Ordenar etapa", { exact: true });
    await expect(tooltip).toBeVisible();
    const rect = await menu.boundingBox(); expect(rect!.width).toBe(44); expect(rect!.height).toBe(44);
    await page.keyboard.press("Enter"); await expect(page.getByRole("menu", { name: "Ordenar etapa Interesado" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Mover a la izquierda" })).toBeFocused();
    await page.keyboard.press("ArrowDown"); await expect(page.getByRole("menuitem", { name: "Mover a la derecha" })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(menu).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const board = page.locator('[aria-label="Etapas de clientes"]');
    if (width > 768) {
      await expect(headings(page)).toHaveCount(6);
      const bounds = await board.evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }));
      expect(bounds.scroll >= bounds.width).toBe(true);
      await expect(page.getByText(/Desplazá el tablero horizontalmente/)).toBeVisible();
    }
    measuredCounts.push(await full.getByText(/^Contacto:/).count());
  }
  expect(measuredCounts).toEqual([1, 1, 1, 1, 1]);
  const contrasts = await page.locator("[data-column] header span[aria-label]").evaluateAll((counts) => {
    const rgb = (value: string) => {
      const channels = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      return value.startsWith("color(") ? channels : channels.map((channel) => channel / 255);
    };
    const luminance = (value: string) => rgb(value).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    return counts.map((count) => {
      const style = getComputedStyle(count), a = luminance(style.color), b = luminance(style.backgroundColor);
      return { stage: count.closest<HTMLElement>("[data-column]")!.dataset.column, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  });
  expect(contrasts).toHaveLength(6); expect(contrasts.every(({ ratio }) => ratio >= 4.5)).toBe(true);
  console.log("Measured stage count contrasts:", contrasts.map(({ stage, ratio }) => `${stage}=${ratio.toFixed(2)}`).join("; "));
  await page.setViewportSize({ width: 390, height: 900 });
  await stages.getByRole("radio", { name: "Cerrado, 0 clientes" }).click();
  await expect(page.locator('[data-column="Cerrado"]')).toBeVisible();
  await expect(page.locator('[data-column="Cerrado"]')).toContainText("Sin clientes en esta etapa de la página.");
  const emptyHeight = (await page.locator('[data-column="Cerrado"]').boundingBox())!.height;
  expect(emptyHeight).toBeLessThan(300);
  await page.reload(); await expect(stages.getByRole("radio", { name: "Cerrado, 0 clientes" })).toHaveAttribute("aria-checked", "true");
  expect(writes).toEqual([]);
});
