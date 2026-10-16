import { expect, test, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { parseFilters } from "../../src/lib/clients/filters";
import { normalizeForm, type Client } from "../../src/lib/clients/model";
import type { ClientComment } from "../../src/lib/comments/model";
import { confirmed } from "../clients/fixture";
let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-crm-comments",
    optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false, include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client", "motion/react", "@dnd-kit/core"] },
    server: { host: "127.0.0.1", port: 3116, strictPort: true }, resolve: { alias: { "@": resolve("src") } },
    plugins: [react(), { name: "local-comment-boundaries", enforce: "pre",
      resolveId(id) { return ["next/link", "next/navigation"].includes(id) || /\/clientes\/(?:comment-)?actions$/.test(id) ? `\0${id}` : undefined; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>window.crmHarness;";
        if (id === "\0next/link") return "import {createElement} from 'react'; export default function Link({prefetch,onNavigate,...props}){return createElement('a',props)}";
        if (id.endsWith("/clientes/comment-actions")) return `const call=async(path,input)=>(await fetch('/__comments/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).json();
          export const loadClientComments=input=>call('read',input); export const createClientComment=input=>call('create',input); export const archiveClientComment=input=>call('archive',input);`;
        if (id.endsWith("/clientes/actions")) return `export async function saveClient(_state,form){return (await fetch('/__save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))})).json()}
          export async function moveClient(){throw new Error('Moves disabled')} export const deleteClient=moveClient;`;
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (!new URL(request.url!, "http://local.invalid").pathname.startsWith("/clientes")) return next();
        response.setHeader("Content-Type", "text/html");
        response.end(await vite.transformIndexHtml(request.url!, '<html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="padding:12px"><div id="root"></div><script type="module" src="/tests/e2e/client-modal-harness.tsx"></script></body></html>'));
      }); },
    }] });
  await server.listen();
  for (const path of ["/tests/e2e/client-modal-harness.tsx", "/src/components/clients/client-list.tsx", "/src/components/clients/client-details.tsx",
    "/src/components/clients/client-comments.tsx", "/src/components/clients/client-form.tsx", "/src/components/clients/clients.module.css", "/src/app/globals.css"])
    await server.transformRequest(path);
});
test.afterAll(async () => { await server?.close(); });
const actor = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const identifier = (number: number) => `c0000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
function comment(number: number, fields: Partial<ClientComment> = {}): ClientComment {
  return { id: identifier(number), client_id: confirmed.id, body: `Seguimiento ${number}`, legacy: false, author_id: actor,
    author_email: "propio@example.test", created_at: "2026-10-16T15:00:00.123456+00:00", imported_at: null,
    sort_at: "2026-10-16T15:00:00.123456+00:00", archived_at: null, archived_by: null, archived_by_email: null, ...fields };
}
// Stateful HTTP boundary fixtures exercise real React/DOM/network behavior. SQL/Auth
// authorization, atomicity and idempotency remain independently proven by WU-001.
async function fixtures(page: Page) {
  page.on("pageerror", (error) => console.error("Local comments browser error:", error.message));
  let clients: Client[] = [{ ...confirmed, company: "Empresa", email: "persona@example.test" }];
  const rows = [comment(1), comment(2, { author_id: other, author_email: "otro@example.test", body: "<img src=x onerror=alert(1)>\n" + "Largo".repeat(150) }),
    comment(3, { legacy: true, author_id: null, author_email: null, created_at: null, imported_at: "2026-10-16T15:00:00.123456+00:00", body: "Texto anterior exacto" })];
  const requests: { operation: string; input: Record<string, string> }[] = [], forbidden: string[] = [];
  const receipts = new Map<string, unknown>();
  let readFailure = false, mutationMode: "success" | "uncertain" | "delayed" = "success", finish: (() => void) | undefined;
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3116" || request.method() !== "GET" && !["/__save", "/__comments/read", "/__comments/create", "/__comments/archive"].includes(url.pathname)) {
      forbidden.push(request.url()); await route.abort(); return;
    }
    if (url.pathname === "/__fixture") {
      const parsed = parseFilters(Object.fromEntries(url.searchParams)); if (!parsed.ok) throw new Error("Invalid filters");
      await route.fulfill({ json: { kind: "found", filters: parsed.filters, rows: clients, count: clients.length } }); return;
    }
    if (url.pathname === "/__save") {
      const values = request.postDataJSON() as Record<string, string>, form = new FormData();
      Object.entries(values).forEach(([key, value]) => form.set(key, value));
      const parsed = normalizeForm(form);
      if (!parsed.ok) { await route.fulfill({ json: { status: "invalid", errors: parsed.errors } }); return; }
      const saved = { ...confirmed, ...parsed.payload, id: parsed.clientId || identifier(100), name: values.name, version: parsed.clientId ? 3 : 1 } as Client;
      clients = [saved, ...clients.filter((row) => row.id !== saved.id)];
      if (parsed.payload.initial_comment) rows.unshift(comment(101, { client_id: saved.id, body: parsed.payload.initial_comment }));
      await route.fulfill({ json: { status: "success", client: saved } }); return;
    }
    if (url.pathname.startsWith("/__comments/")) {
      const operation = url.pathname.split("/").at(-1)!, input = request.postDataJSON() as Record<string, string>;
      requests.push({ operation, input });
      if (operation === "read") {
        if (readFailure) { readFailure = false; await route.fulfill({ json: { kind: "unavailable", userId: actor } }); return; }
        const archived = Boolean(input.archived), cursor = input.cursor as unknown as { id: string; at: string } | null;
        const matching = rows.filter((row) => row.client_id === input.clientId && Boolean(row.archived_at) === archived);
        const start = cursor ? matching.findIndex((row) => row.id === cursor.id) + 1 : 0, pageRows = matching.slice(start, start + 2);
        const last = pageRows.at(-1);
        await route.fulfill({ json: { kind: "found", userId: actor, rows: pageRows,
          next: start + pageRows.length < matching.length && last ? { at: last.sort_at, id: last.id } : null } }); return;
      }
      if (mutationMode === "delayed") await new Promise<void>((done) => { finish = done; });
      const key = input.requestId;
      if (!receipts.has(key)) {
        const item = operation === "create" ? comment(200 + rows.length, { body: input.body, client_id: input.clientId }) : rows.find((row) => row.id === input.commentId)!;
        if (operation === "create") rows.unshift(item);
        else Object.assign(item, { archived_at: "2026-10-16T16:00:00.654321+00:00", archived_by: actor, archived_by_email: "propio@example.test" });
        receipts.set(key, { kind: "success", comment: { ...item } });
      }
      await route.fulfill({ json: mutationMode === "uncertain" ? { kind: "error", retry: true, message: "No podemos confirmar la operación. Reintentá la misma intención." } : receipts.get(key) }); return;
    }
    await route.continue();
  });
  return { requests, forbidden, rows, failRead: () => { readFailure = true; }, mode: (value: typeof mutationMode) => { mutationMode = value; }, finish: () => finish!() };
}
async function openDetail(page: Page) {
  const opener = page.getByRole("button", { name: "Ver Confirmado" });
  await opener.focus(); await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog", { name: "Confirmado", exact: true });
  await expect(detail.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
  await expect(detail.getByText("propio@example.test", { exact: true })).toBeVisible();
  return { detail, opener };
}
for (const width of [390, 640, 768, 1024, 1440]) test(`history, pagination, keyboard and responsive targets at ${width}px`, async ({ page }) => {
  const data = await fixtures(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/clientes?vista=tabla");
    await page.setViewportSize({ width, height: 900 });
    const { detail, opener } = await openDetail(page);
    await expect(detail.getByText("16/10/2026 12:00", { exact: true }).first()).toBeVisible();
    const icon = detail.getByRole("button", { name: "Archivar comentario" });
    await expect(icon).toHaveCount(1);
    await icon.focus();
    const tooltip = icon.locator("span"); await expect(tooltip).toBeVisible();
    const box = await icon.boundingBox(), tip = await tooltip.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(tip!.x).toBeGreaterThanOrEqual(0); expect(tip!.x + tip!.width).toBeLessThanOrEqual(width);
    await detail.getByRole("button", { name: "Cargar más comentarios" }).click();
    await expect(detail.getByText("Nota anterior", { exact: true })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Archivar comentario" })).toHaveCount(2);
    await expect(detail.locator("img")).toHaveCount(0);
    await expect(detail.getByText(/<img src=x onerror=alert/)).toBeVisible();
    expect(data.requests.some((request) => request.operation === "read" && (request.input.cursor as unknown as { at: string } | null)?.at === "2026-10-16T15:00:00.123456+00:00")).toBe(true);
    expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await detail.getByRole("button", { name: "Cerrar", exact: true }).focus();
    await page.keyboard.press("Shift+Tab"); await expect(detail.getByRole("button", { name: "Archivar comentario" }).last()).toBeFocused();
    await page.keyboard.press("Tab"); await expect(detail.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(detail).toHaveCount(0); await expect(opener).toBeFocused();
  expect(data.forbidden).toEqual([]);
});
test("archive metadata, permissions and recovery of a failed read", async ({ page }) => {
  const data = await fixtures(page); await page.goto("/clientes?vista=tabla");
  const { detail } = await openDetail(page);
  await detail.getByRole("button", { name: "Archivar comentario" }).click();
  await expect(detail.getByRole("heading", { name: "Comentarios", exact: true })).toBeFocused();
  await detail.getByRole("button", { name: "Ver archivados" }).click();
  await expect(detail.getByRole("button", { name: "Volver a comentarios" })).toBeFocused();
  await expect(detail.getByRole("textbox")).toHaveCount(0);
  await expect(detail.getByText(/Archivado por propio@example.test/)).toBeVisible();
  await expect(detail.getByRole("button", { name: "Archivar comentario" })).toHaveCount(0);
  data.failRead(); await detail.getByRole("button", { name: "Volver a comentarios" }).click();
  await expect(detail.getByRole("alert")).toContainText("No pudimos cargar");
  await detail.getByRole("button", { name: "Reintentar lectura" }).click();
  await expect(detail.getByText("otro@example.test", { exact: true })).toBeVisible();
  expect(data.forbidden).toEqual([]);
});
test("draft guards, uncertain intentions, duplicates and confirmed reconciliation", async ({ page }) => {
  const data = await fixtures(page); await page.goto("/clientes?vista=tabla");
  const { detail, opener } = await openDetail(page), input = detail.getByRole("textbox", { name: "Nuevo comentario" });
  await input.fill("Mi comentario\ncon saltos");
  await detail.getByRole("button", { name: "Cerrar", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "¿Descartar el comentario?" }); await expect(confirm).toBeVisible();
  await page.keyboard.press("Escape"); await expect(confirm).toHaveCount(0); await expect(detail).toBeVisible();
  await expect(input).toHaveValue("Mi comentario\ncon saltos");
  await detail.getByRole("link", { name: "Editar Confirmado" }).click();
  await expect(confirm).toBeVisible(); await confirm.getByRole("button", { name: "Seguir escribiendo" }).click();
  await expect(detail.getByRole("link", { name: "Editar Confirmado" })).toBeFocused();
  data.mode("delayed"); await detail.getByRole("button", { name: "Agregar comentario" }).click();
  await expect(detail.getByRole("button", { name: "Agregando…" })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(detail).toBeVisible();
  expect(data.requests.filter((request) => request.operation === "create")).toHaveLength(1);
  data.mode("uncertain"); data.finish();
  await expect(detail.getByRole("alert")).toContainText("No podemos confirmar");
  await expect(input).toHaveAttribute("readonly", "");
  await expect(detail.getByRole("button", { name: "Cerrar", exact: true })).toBeDisabled();
  data.mode("success"); await detail.getByRole("button", { name: "Reintentar operación" }).click();
  await expect(input).toHaveValue(""); await expect(input).toBeFocused();
  const writes = data.requests.filter((request) => request.operation === "create"); expect(writes).toHaveLength(2); expect(writes[0].input).toEqual(writes[1].input);
  expect(data.rows.filter((row) => row.body === "Mi comentario\ncon saltos")).toHaveLength(1);
  await input.fill("Descartar antes de editar"); await detail.getByRole("link", { name: "Editar Confirmado" }).click();
  await confirm.getByRole("button", { name: "Descartar comentario" }).click();
  const editor = page.getByRole("dialog", { name: "Editar cliente" }); await expect(editor).toBeVisible();
  await expect(editor.getByLabel("Notas")).toHaveCount(0); await expect(editor.getByLabel("Nombre *")).toBeFocused();
  await editor.getByRole("button", { name: "Cancelar" }).click(); await expect(opener).toBeFocused();
  expect(data.forbidden).toEqual([]);
});
test("Back preserves the comment on cancel and closes details at the original history destination after discard", async ({ page }) => {
  const data = await fixtures(page); await page.goto("/clientes");
  const originalState = { destination: "kanban", nextState: "preserved" };
  await page.evaluate((state) => history.replaceState(state, "", location.href), originalState);
  await page.getByRole("radio", { name: "Tabla", exact: true }).click();
  const tableState = { destination: "table", editorState: "preserved" };
  await page.evaluate((state) => history.replaceState(state, "", location.href), tableState);
  const { detail } = await openDetail(page), input = detail.getByRole("textbox", { name: "Nuevo comentario" });
  await input.fill("Borrador antes de volver");
  const confirm = page.getByRole("dialog", { name: "¿Descartar el comentario?" });
  for (const discard of [false, true]) {
    await page.goBack(); await expect(confirm).toBeVisible();
    await expect(page).toHaveURL("http://127.0.0.1:3116/clientes?vista=tabla");
    expect(await page.evaluate(() => history.state)).toEqual(tableState);
    await expect(input).toHaveValue("Borrador antes de volver");
    await confirm.getByRole("button", { name: discard ? "Descartar comentario" : "Seguir escribiendo" }).click();
    if (!discard) { await expect(confirm).toHaveCount(0); await expect(input).toHaveValue("Borrador antes de volver"); }
  }
  await expect(detail).toHaveCount(0);
  await expect(page).toHaveURL("http://127.0.0.1:3116/clientes");
  expect(await page.evaluate(() => history.state)).toEqual(originalState);
  await expect(page.getByRole("radio", { name: "Kanban", exact: true })).toHaveAttribute("aria-checked", "true");
  expect(data.requests.filter((request) => request.operation !== "read")).toEqual([]);
  expect(data.forbidden).toEqual([]);
});

test("pending comments block Back, then clean details close at the preserved destination", async ({ page }) => {
  const data = await fixtures(page); await page.goto("/clientes");
  const originalState = { destination: "kanban", preserved: true };
  await page.evaluate((state) => {
    history.replaceState(state, "", location.href);
    document.documentElement.dataset.historyPops = "0";
    window.addEventListener("popstate", () => {
      document.documentElement.dataset.historyPops = String(Number(document.documentElement.dataset.historyPops) + 1);
    }, true);
  }, originalState);
  await page.getByRole("radio", { name: "Tabla", exact: true }).click();
  const { detail } = await openDetail(page), input = detail.getByRole("textbox", { name: "Nuevo comentario" });
  await input.fill("Confirmar antes de volver"); data.mode("delayed");
  await detail.getByRole("button", { name: "Agregar comentario" }).click();
  await expect.poll(() => data.requests.filter((request) => request.operation === "create").length).toBe(1);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => Number(document.documentElement.dataset.historyPops))).toBe(2);
  await expect(page).toHaveURL("http://127.0.0.1:3116/clientes?vista=tabla");
  await expect(detail).toBeVisible(); await expect(input).toHaveValue("Confirmar antes de volver");
  await expect(page.getByRole("dialog", { name: "¿Descartar el comentario?" })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Cerrar", exact: true })).toBeDisabled();
  data.mode("success"); data.finish(); await expect(input).toHaveValue("");
  await page.goBack(); await expect(detail).toHaveCount(0);
  await expect(page).toHaveURL("http://127.0.0.1:3116/clientes");
  expect(await page.evaluate(() => history.state)).toEqual(originalState);
  await expect(page.getByRole("radio", { name: "Kanban", exact: true })).toHaveAttribute("aria-checked", "true");
  expect(data.forbidden).toEqual([]);
});

test("initial comment survives create, reopen and later editing without an editable notes field", async ({ page }) => {
  const data = await fixtures(page); await page.goto("/clientes?vista=tabla");
  await page.getByRole("link", { name: "Nuevo cliente", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Nuevo cliente" });
  await create.getByLabel("Nombre *").fill("Con inicial");
  await create.getByLabel("Comentario inicial (opcional)").fill("  Inicio\nexacto 🧉  ");
  await create.getByRole("button", { name: "Crear cliente" }).click(); await expect(create).toHaveCount(0);
  await page.getByRole("button", { name: "Ver Con inicial" }).click();
  const detail = page.getByRole("dialog", { name: "Con inicial", exact: true });
  await expect(detail.getByText("Inicio exacto 🧉", { exact: true })).toBeVisible();
  expect(data.rows.find((row) => row.body.includes("Inicio"))?.body).toBe("  Inicio\nexacto 🧉  ");
  await detail.getByRole("link", { name: "Editar Con inicial" }).click();
  const edit = page.getByRole("dialog", { name: "Editar cliente" });
  await expect(edit.getByLabel("Notas")).toHaveCount(0); await expect(edit.getByLabel("Comentario inicial (opcional)")).toHaveCount(0);
  expect(data.forbidden).toEqual([]);
});
