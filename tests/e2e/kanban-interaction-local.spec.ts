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
    optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false, include: ["react", "react/jsx-runtime", "react-dom/client", "@dnd-kit/core"] },
    server: { host: "127.0.0.1", port: 3113, strictPort: true }, resolve: { alias: { "@": resolve("src") } }, plugins: [react(), {
      name: "local-modal-boundaries", enforce: "pre",
      resolveId(id) { return ["next/link", "next/navigation"].includes(id) || id.endsWith("/clientes/actions") ? `\0${id}` : undefined; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>window.crmHarness;";
        if (id === "\0next/link") return "import {createElement} from 'react'; export default function Link({prefetch,...props}){return createElement('a',props)}";
        if (id.endsWith("/clientes/actions")) return "export const moveClient=async intent=>(await fetch('/__move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(intent)})).json(); export async function saveClient(){throw new Error('Saves disabled in kanban harness')}";
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (new URL(request.url!, "http://local.invalid").pathname !== "/clientes") return next();
        try {
          response.setHeader("Content-Type", "text/html");
          response.end(await vite.transformIndexHtml(request.url!, '<html lang="es"><body style="padding:24px"><div id="root"></div><script type="module" src="/tests/e2e/client-modal-harness.tsx"></script></body></html>'));
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
  await card(page).getByText("Rubro: Sin informar").evaluate((element) => { const range = document.createRange(); range.selectNodeContents(element); getSelection()!.addRange(range); });
  await open.click(); await expect(page.getByRole("dialog")).toHaveCount(0); await page.evaluate(() => getSelection()!.removeAllRanges());
  const body = await card(page).getByText("Rubro: Sin informar").boundingBox(), target = await page.locator('[data-column="Interesado"]').boundingBox();
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
  await expect(open).toHaveAttribute("aria-disabled", "true"); await expect(page.getByRole("button", { name: "Arrastrar columna Contactado" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Tabla", exact: true })).toHaveAttribute("aria-disabled", "true");
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
  await page.goto("/clientes"); const visible = page.getByRole("combobox", { name: "Estado visible" });
  await expect(visible).toHaveValue("Cerrado"); expect(await visible.locator("option").evaluateAll((options) => options.map((option) => option.getAttribute("value")))).toEqual(order);
  await visible.selectOption("Contactado"); const open = card(page).getByRole("button", { name: "Abrir Confirmado" });
  await open.tap(); await expect(page.getByRole("dialog")).toBeVisible(); await page.getByRole("button", { name: "Cancelar" }).tap(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await open.scrollIntoViewIfNeeded(); const box = await open.boundingBox(), before = await page.evaluate(() => scrollY);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box!.x + 80, y: box!.y + 80 }] });
  for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box!.x + 80, y: box!.y + 80 - step * 18 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cdp.detach();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before); await expect(page.getByRole("dialog")).toHaveCount(0); expect(data.moves).toEqual([]);
  const handle = card(page).getByRole("button", { name: "Arrastrar cliente Confirmado" }); await handle.focus();
  expect((await handle.boundingBox())!.width).toBe(44); expect((await handle.boundingBox())!.height).toBe(44);
  await page.keyboard.press("Space"); await page.keyboard.press("ArrowRight"); await expect(visible).toHaveValue("Sin respuesta"); await page.keyboard.press("Space");
  await expect(page.getByText("Estado actualizado", { exact: true })).toBeVisible(); expect(data.moves[0].to).toBe("Sin respuesta");
  const menu = page.getByRole("button", { name: "Ordenar columna Sin respuesta" }); await menu.click();
  await page.getByRole("button", { name: "Mover a la izquierda", exact: true }).click();
  const next = ["Cerrado", "Sin respuesta", "Contactado", "Interesado", "Reunión agendada", "Respuesta negativa"];
  expect(await visible.locator("option").evaluateAll((options) => options.map((option) => option.getAttribute("value")))).toEqual(next);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual(next);
  await menu.click(); await page.getByRole("button", { name: "Mover a la derecha", exact: true }).focus(); await page.keyboard.press("Escape"); await expect(menu).toBeFocused();
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
