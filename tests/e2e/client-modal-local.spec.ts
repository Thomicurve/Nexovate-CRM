import { expect, test, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { parseFilters } from "../../src/lib/clients/filters";
import { normalizeForm, type Client } from "../../src/lib/clients/model";
import { confirmed } from "../clients/fixture";

let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-crm-modal",
    optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false, include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client", "motion/react", "@dnd-kit/core"] },
    server: { host: "127.0.0.1", port: 3112, strictPort: true },
    resolve: { alias: { "@": resolve("src") } }, plugins: [react(), {
      name: "local-modal-boundaries", enforce: "pre",
      resolveId(id) { return ["next/link", "next/navigation"].includes(id) || id.endsWith("/clientes/actions") ? `\0${id}` : undefined; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>window.crmHarness;";
        if (id === "\0next/link") return "import {createElement} from 'react'; export default function Link({prefetch,onNavigate,...props}){return createElement('a',props)}";
        if (id.endsWith("/clientes/actions")) return "export async function moveClient(){throw new Error('Moves disabled')} export const deleteClient=moveClient; export async function saveClient(_state,form){return (await fetch('/__save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))})).json()}";
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (!new URL(request.url!, "http://local.invalid").pathname.startsWith("/clientes")) return next();
        response.setHeader("Content-Type", "text/html");
        response.end(await vite.transformIndexHtml(request.url!, '<html lang="es"><body style="padding:24px"><div id="root"></div><script type="module" src="/tests/e2e/client-modal-harness.tsx"></script></body></html>'));
      }); },
    }] });
  await server.listen();
});
test.afterAll(async () => { await server?.close(); });

async function fixtures(page: Page) {
  let client: Client = { ...confirmed, email: "persona@example.com", notes: "Notas completas" };
  const reads: string[] = [], saves: Record<string, string>[] = [], forbidden: string[] = [];
  let mode: "success" | "uncertain" | "conflict" | "transport" = "success", finish: (() => void) | undefined;
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3112" || request.method() !== "GET" && url.pathname !== "/__save") {
      forbidden.push(request.url()); await route.abort(); return;
    }
    if (url.pathname === "/__fixture") {
      reads.push(request.url());
      const parsed = parseFilters(Object.fromEntries(new URL(page.url()).pathname === "/clientes" ? url.searchParams : []));
      if (!parsed.ok) throw new Error("Invalid local fixture filters");
      const matches = !parsed.filters.name || client.name.includes(parsed.filters.name);
      await route.fulfill({ json: { kind: "found", filters: parsed.filters, rows: matches ? [client] : [], count: matches ? 101 : 0 } }); return;
    }
    if (url.pathname === "/__save") {
      const values = request.postDataJSON() as Record<string, string>; saves.push(values);
      const form = new FormData(); Object.entries(values).forEach(([key, value]) => form.set(key, value));
      const parsed = normalizeForm(form);
      if (!parsed.ok) { await route.fulfill({ json: { status: "invalid", errors: parsed.errors, message: "Revisá los campos indicados." } }); return; }
      if (mode === "transport") { await route.abort(); return; }
      if (mode === "uncertain") {
        await new Promise<void>((resolve) => { finish = resolve; });
        await route.fulfill({ json: { status: "error", retry: true, message: "No podemos confirmar el guardado." } }); return;
      }
      if (mode === "conflict") { client = { ...client, name: "Versión del socio", version: 3 }; await route.fulfill({ json: { status: "conflict", confirmed: client } }); return; }
      client = { ...client, ...parsed.payload, name: values.name, version: client.version + 1 } as Client;
      await route.fulfill({ json: { status: "success", client } }); return;
    }
    await route.continue();
  });
  return { reads, saves, forbidden, mode: (next: typeof mode) => { mode = next; }, finish: () => finish!() };
}

test("native modal focus, background, motion, mobile scrolling and direct link return", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixtures(page);
  await page.goto("/clientes?nombre=Confirmado&pagina=2&vista=tabla");
  const opener = page.getByRole("button", { name: "Ver Confirmado" }); await opener.focus(); await page.keyboard.press("Enter"); await page.getByRole("link", { name: /^Editar / }).click();
  const dialog = page.getByRole("dialog", { name: "Editar cliente" }); await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Nombre *")).toBeFocused();
  await expect(dialog.getByLabel("Notas")).toHaveValue("Notas completas");
  const initialReads = data.reads.length;
  await expect.poll(() => dialog.evaluate((element) => (element as HTMLElement).style.transform)).toBe("");
  expect((await dialog.boundingBox())!.width).toBeCloseTo(800, 0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.getByRole("button", { name: "Actualizar", exact: true }).evaluate((button: HTMLButtonElement) => button.focus());
  expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
  for (const key of ["Tab", "Shift+Tab"]) for (let step = 0; step < 18; step++) {
    await page.keyboard.press(key); expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  }
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused(); expect(data.reads).toHaveLength(initialReads);
  await page.getByRole("link", { name: "Nuevo cliente", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo cliente" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar formulario" }).click(); await expect(page.getByRole("dialog", { name: /^(Nuevo cliente|Editar cliente)$/ })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 700 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await opener.click(); await page.getByRole("link", { name: /^Editar / }).click(); await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("animation-name", "none");
  expect((await dialog.boundingBox())!.width).toBeCloseTo(350, 0);
  const body = dialog.locator(":scope > section"); expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const save = dialog.getByRole("button", { name: "Guardar cambios" }); await expect(save).toBeInViewport();
  const close = dialog.getByRole("button", { name: "Cerrar formulario" }); await expect(close).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Cancelar" }).click(); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
  const returnTo = "/clientes?nombre=Confirmado&pagina=2&vista=tabla";
  for (const path of ["/clientes/nuevo", `/clientes/${confirmed.id}/editar`]) {
    await page.goto(`${path}?returnTo=${encodeURIComponent(returnTo)}`);
    await expect(page.getByRole("dialog", { name: /^(Nuevo cliente|Editar cliente)$/ })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click(); await expect(page).toHaveURL(`http://127.0.0.1:3112${returnTo}`);
  }
  expect(data.forbidden).toEqual([]);
});

test("validation, pending and uncertain retries, conflicts and confirmed save update local context", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixtures(page);
  await page.goto("/clientes?vista=tabla");
  await page.getByRole("link", { name: "Nuevo cliente", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^(Nuevo cliente|Editar cliente)$/ }), url = page.url();
  await dialog.getByRole("button", { name: "Crear cliente" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Revisá los campos indicados."); await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByLabel("Nombre *")).toHaveAttribute("aria-invalid", "true");
  await dialog.getByLabel("Nombre *").fill("Cliente simulado");
  data.mode("uncertain"); await dialog.getByRole("button", { name: "Crear cliente" }).click();
  await expect(dialog.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  await expect.poll(() => data.saves.length).toBe(2); data.finish();
  await expect(dialog.getByRole("alert")).toHaveText("No podemos confirmar el guardado.");
  await expect(dialog.getByRole("button", { name: "Cerrar formulario" })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Nombre *")).toHaveValue("Cliente simulado");
  data.mode("success"); await dialog.getByRole("button", { name: "Reintentar" }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole("status").filter({ hasText: "Cliente creado" })).toHaveText("Cliente creadoCliente simulado");
  await expect(page.getByRole("table")).toContainText("Cliente simulado"); await expect(page).toHaveURL(url);
  expect(data.saves[2]).toEqual(data.saves[1]); expect(data.saves[1].request_id).not.toBe(data.saves[0].request_id);
  await page.getByRole("button", { name: "Ver Cliente simulado" }).click(); await page.getByRole("link", { name: /^Editar / }).click();
  data.mode("conflict"); await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Tus cambios no se guardaron. Compará tu borrador con los datos actuales.");
  await expect(dialog.getByText("Versión confirmada: 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Usar datos actuales" }).click();
  await expect(dialog.getByLabel("Nombre *")).toHaveValue("Versión del socio");
  await expect(dialog.getByLabel("Nombre *")).toBeFocused();
  data.mode("transport"); await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(/Reintentá con los mismos datos/);
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  data.mode("success"); await dialog.getByRole("button", { name: "Reintentar" }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole("table")).toContainText("Versión del socio");
  expect(data.saves[5]).toEqual(data.saves[4]); expect(data.saves[4].version).toBe("3");
  expect(data.forbidden).toEqual([]);
});

test("editing a row out of the active filter restores focus to a stable list control", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixtures(page);
  await page.goto("/clientes?nombre=Confirmado&vista=tabla");
  await page.getByRole("button", { name: "Ver Confirmado" }).click(); await page.getByRole("link", { name: /^Editar / }).click();
  const dialog = page.getByRole("dialog", { name: /^(Nuevo cliente|Editar cliente)$/ });
  await dialog.getByLabel("Nombre *").fill("Fuera del filtro");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("No hay clientes que coincidan con los filtros.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Tabla", exact: true }), await page.evaluate(() => document.activeElement?.outerHTML)).toBeFocused();
  expect(data.forbidden).toEqual([]);
});

for (const fallback of [false, true]) test(`dirty History back/cancel/repeat/discard, fallback=${fallback}`, async ({ page }) => {
  const data = await fixtures(page);
  const editor = `/clientes/${confirmed.id}/editar`;
  await page.addInitScript(({ editor, fallback }) => {
    if (fallback) Object.defineProperty(window, "navigation", { configurable: true, value: undefined });
    if (location.pathname !== editor) return;
    history.replaceState({ destination: 1, nextState: "preserved" }, "", "/clientes?destino=1");
    history.pushState({ destination: 2 }, "", "/clientes?destino=2");
    history.pushState({ editor: true, nextState: "untouched" }, "", editor);
  }, { editor, fallback });
  await page.goto(editor);
  if (!fallback) expect(await page.evaluate(() => (window as Window & { navigation?: { currentEntry?: { index: number } } }).navigation?.currentEntry?.index ?? -1)).toBeGreaterThanOrEqual(0);
  const dialog = page.getByRole("dialog", { name: "Editar cliente" });
  await dialog.getByLabel("Nombre *").fill("Borrador propio");
  const length = await page.evaluate(() => history.length);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.evaluate(() => history.back());
    await expect(page.getByRole("dialog", { name: "¿Descartar los cambios?" })).toBeVisible();
    await expect(page).toHaveURL(`http://127.0.0.1:3112${editor}`);
    expect(await page.evaluate(() => history.state)).toEqual({ editor: true, nextState: "untouched" });
    expect(await page.evaluate(() => history.length)).toBe(length);
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(dialog.getByLabel("Nombre *")).toHaveValue("Borrador propio");
  }
  // Long traversal restores the mounted editor and preserves the intended target state.
  await page.evaluate(() => history.go(-2));
  await expect(page.getByRole("button", { name: "Descartar" })).toBeVisible();
  await expect(page).toHaveURL(`http://127.0.0.1:3112${editor}`);
  await expect(dialog.getByLabel("Nombre *")).toHaveValue("Borrador propio");
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3112/clientes?destino=1");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => history.state)).toEqual({ destination: 1, nextState: "preserved" });
  expect(data.saves).toEqual([]);
  await page.goto(editor); await expect(dialog).toBeVisible();
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL("http://127.0.0.1:3112/clientes?destino=2");
  await expect(dialog).toHaveCount(0); await expect(page.getByRole("button", { name: "Descartar" })).toHaveCount(0);
  expect(data.forbidden).toEqual([]);
});

test("dirty link exit, pending History lock and responsive form fields", async ({ page }) => {
  const data = await fixtures(page), editor = `/clientes/${confirmed.id}/editar`;
  await page.addInitScript((editor) => {
    if (location.pathname !== editor) return;
    history.replaceState({ destination: true }, "", "/clientes"); history.pushState({ editor: true }, "", editor);
  }, editor);
  await page.goto(editor);
  const dialog = page.getByRole("dialog", { name: "Editar cliente" });
  for (const width of [390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const label of ["Rubro", "Fecha de reunión"]) {
      const field = dialog.getByLabel(label); expect(Math.round((await field.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
      expect(await field.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
  }
  // A 200% effective viewport retains the same controls and one-column reflow.
  await page.setViewportSize({ width: 390, height: 450 });
  await dialog.getByLabel("Nombre *").fill("Borrador enlace");
  await page.evaluate(() => { const link = document.createElement("a"); link.href = "/clientes?nombre=destino"; link.textContent = "Otra página"; document.body.append(link); link.click(); });
  await expect(page.getByRole("button", { name: "Seguir editando" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog.getByLabel("Nombre *")).toHaveValue("Borrador enlace");
  data.mode("uncertain"); await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  await page.evaluate(() => history.back()); await expect(page).toHaveURL(`http://127.0.0.1:3112${editor}`);
  await expect(page.getByRole("button", { name: "Descartar" })).toHaveCount(0);
  await expect.poll(() => data.saves.length).toBe(1); data.finish();
  await expect(dialog.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await page.evaluate(() => history.back()); await expect(page).toHaveURL(`http://127.0.0.1:3112${editor}`);
  await expect(dialog.getByLabel("Nombre *")).toHaveValue("Borrador enlace");
  data.mode("success"); await dialog.getByRole("button", { name: "Reintentar" }).click();
  await expect(dialog).toHaveCount(0); expect(data.saves[1]).toEqual(data.saves[0]);
  await page.goto(editor); await dialog.getByLabel("Nombre *").fill("Descartar enlace");
  await page.evaluate(() => { const link = document.createElement("a"); link.href = "/clientes?nombre=destino"; document.body.append(link); link.click(); });
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3112/clientes?nombre=destino");
  expect(data.saves).toHaveLength(2); expect(data.forbidden).toEqual([]);
});

test("inline editor protects History before the list consumer and closes after discard or clean traversal", async ({ page }) => {
  await fixtures(page); await page.goto("/clientes?vista=tabla");
  await page.evaluate(() => {
    history.replaceState({ previous: true }, "", "/clientes?vista=kanban");
    history.pushState({ editor: true }, "", "/clientes?vista=tabla");
  });
  await page.getByRole("button", { name: "Ver Confirmado" }).click();
  await page.getByRole("link", { name: "Editar Confirmado" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar cliente" });
  await dialog.getByLabel("Nombre *").fill("Inline sin guardar");
  await page.evaluate(() => history.back());
  await expect(page.getByRole("button", { name: "Seguir editando" })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3112/clientes?vista=tabla");
  await page.getByRole("button", { name: "Seguir editando" }).click();
  await expect(dialog.getByLabel("Nombre *")).toHaveValue("Inline sin guardar");
  await page.evaluate(() => history.back()); await page.getByRole("button", { name: "Descartar" }).click();
  await expect(dialog).toHaveCount(0); await expect(page).toHaveURL("http://127.0.0.1:3112/clientes?vista=kanban");
  expect(await page.evaluate(() => history.state)).toEqual({ previous: true });
  await expect(page.getByRole("radio", { name: "Kanban", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.goto("/clientes?vista=tabla");
  await page.evaluate(() => { history.replaceState({ previous: true }, "", "/clientes?vista=kanban"); history.pushState({ editor: true }, "", "/clientes?vista=tabla"); });
  await page.getByRole("button", { name: "Ver Confirmado" }).click(); await page.getByRole("link", { name: "Editar Confirmado" }).click();
  await expect(dialog).toBeVisible(); await page.evaluate(() => history.back());
  await expect(dialog).toHaveCount(0); await expect(page.getByRole("button", { name: "Descartar" })).toHaveCount(0);
  expect(await page.evaluate(() => history.state)).toEqual({ previous: true });
});
