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
    optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false, include: ["react", "react/jsx-runtime", "react-dom/client", "@dnd-kit/core"] },
    server: { host: "127.0.0.1", port: 3112, strictPort: true },
    resolve: { alias: { "@": resolve("src") } }, plugins: [react(), {
      name: "local-modal-boundaries", enforce: "pre",
      resolveId(id) { return ["next/link", "next/navigation"].includes(id) || id.endsWith("/clientes/actions") ? `\0${id}` : undefined; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>window.crmHarness;";
        if (id === "\0next/link") return "import {createElement} from 'react'; export default function Link({prefetch,...props}){return createElement('a',props)}";
        if (id.endsWith("/clientes/actions")) return "export async function moveClient(){throw new Error('Moves disabled')} export async function saveClient(_state,form){return (await fetch('/__save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))})).json()}";
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
  const opener = page.getByRole("link", { name: "Editar Confirmado" }); await opener.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Editar cliente" }); await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Nombre *")).toBeFocused();
  await expect(dialog.getByLabel("Notas")).toHaveValue("Notas completas");
  const initialReads = data.reads.length;
  await expect(dialog).toHaveCSS("animation-duration", "0.2s");
  expect((await dialog.boundingBox())!.width).toBeCloseTo(800, 0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.getByRole("button", { name: "Actualizar", exact: true }).evaluate((button: HTMLButtonElement) => button.focus());
  expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
  for (const key of ["Tab", "Shift+Tab"]) for (let step = 0; step < 18; step++) {
    await page.keyboard.press(key); expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  }
  await page.keyboard.press("Escape"); await expect(dialog).toHaveAttribute("data-closing", "true"); await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused(); expect(data.reads).toHaveLength(initialReads);
  await page.getByRole("link", { name: "Nuevo cliente", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo cliente" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar formulario" }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 700 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await opener.click(); await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("animation-name", "none");
  expect((await dialog.boundingBox())!.width).toBeCloseTo(366, 0);
  const body = dialog.locator("section"); expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const save = dialog.getByRole("button", { name: "Guardar cambios" }); await expect(save).toBeInViewport();
  const close = dialog.getByRole("button", { name: "Cerrar formulario" }); await expect(close).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Cancelar" }).click(); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
  const returnTo = "/clientes?nombre=Confirmado&pagina=2&vista=tabla";
  for (const path of ["/clientes/nuevo", `/clientes/${confirmed.id}/editar`]) {
    await page.goto(`${path}?returnTo=${encodeURIComponent(returnTo)}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click(); await expect(page).toHaveURL(`http://127.0.0.1:3112${returnTo}`);
  }
  expect(data.forbidden).toEqual([]);
});

test("validation, pending and uncertain retries, conflicts and confirmed save update local context", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixtures(page);
  await page.goto("/clientes?vista=tabla");
  await page.getByRole("link", { name: "Nuevo cliente", exact: true }).click();
  const dialog = page.getByRole("dialog"), url = page.url();
  await dialog.getByRole("button", { name: "Crear cliente" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Revisá los campos indicados.");
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
  await page.getByRole("link", { name: "Editar Cliente simulado" }).click();
  data.mode("conflict"); await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Este cliente se actualizó mientras lo editabas.");
  await expect(dialog.getByText("Versión confirmada: 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Volver a editar" }).click();
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
  await page.getByRole("link", { name: "Editar Confirmado" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre *").fill("Fuera del filtro");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("No hay clientes que coincidan con los filtros.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Tabla", exact: true })).toBeFocused();
  expect(data.forbidden).toEqual([]);
});
