import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-global-loading",
    optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false, include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"] },
    server: { host: "127.0.0.1", port: 3116, strictPort: true }, resolve: { alias: { "@": resolve("src") } },
    plugins: [react(), { name: "loading-boundaries", enforce: "pre",
      resolveId(id) { if (["next/link", "next/navigation"].includes(id)) return `\0${id}`; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>({replace(){},push(){}});";
        if (id === "\0next/link") return "import {createElement} from 'react';export default function Link({prefetch,onNavigate,...props}){return createElement('a',props)}";
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (new URL(request.url!, "http://local.invalid").pathname !== "/") return next();
        response.setHeader("Content-Type", "text/html"); response.end(await vite.transformIndexHtml("/", '<html lang="es"><body><div id="root"></div><script type="module" src="/tests/e2e/global-loading-harness.tsx"></script></body></html>'));
      }); },
    }] }); await server.listen();
});
test.afterAll(async () => { await server?.close(); });
for (const mobile of [false, true]) test(`top layer blocks dialog input and restores focus after failure; mobile=${mobile}`, async ({ page }) => {
  if (mobile) { await page.setViewportSize({ width: 390, height: 700 }); await page.emulateMedia({ reducedMotion: "reduce" }); }
  await page.goto("/"); await page.getByRole("button", { name: "Editar", exact: true }).click();
  const edit = page.locator("dialog:not(.global-loading)");
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  const loader = page.getByRole("dialog", { name: "Cargando" }); await expect(loader).toBeFocused();
  const bounds = (await loader.boundingBox())!; expect(bounds.width).toBe(mobile ? 390 : 1280); expect(bounds.height).toBe(mobile ? 700 : 720);
  expect(await page.evaluate(() => document.elementFromPoint(50, 50)?.closest("dialog")?.className)).toBe("global-loading");
  for (const key of ["Tab", "Shift+Tab", "Escape", "Enter", " "]) { await page.keyboard.press(key); await expect(loader).toBeFocused(); }
  await page.mouse.click(50, 50); await expect(loader).toBeVisible();
  if (mobile) await expect(loader.locator(".ll-run > span").first()).toHaveCSS("animation-name", "none");
  await page.evaluate(() => window.loadingHarness.settle());
  await expect(loader).toHaveCount(0); await expect(edit.getByRole("alert")).toHaveText("Error recuperable");
  await expect(edit.getByRole("button", { name: "Guardar cambios" })).toBeFocused();
  await edit.getByRole("button", { name: "Cancelar" }).click(); await expect(edit).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});
test("overlap retains overlay after action failure and unmount clears it", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.locator("dialog:not(.global-loading)").getByRole("button", { name: "Guardar cambios" }).click();
  const loader = page.getByRole("dialog", { name: "Cargando" }); await expect(loader).toBeVisible();
  await page.evaluate(() => { window.loadingHarness.overlap(); window.loadingHarness.settle(); });
  await expect(page.locator("dialog:not(.global-loading) [role=alert]")).toHaveText("Error recuperable");
  await expect(loader).toBeVisible(); await page.evaluate(() => window.loadingHarness.unmount());
  await expect(loader).toHaveCount(0); expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});
test("successful save closes edit while refresh keeps loading, then releases shared scroll lock", async ({ page }) => {
  await page.goto("/?success=1"); await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.locator("dialog:not(.global-loading)").getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("dialog", { name: "Cargando" })).toBeVisible();
  await page.evaluate(() => window.loadingHarness.settle());
  await expect(page.locator("dialog:not(.global-loading)")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Cargando" })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.evaluate(() => window.loadingHarness.unmount()); await expect(page.getByRole("dialog", { name: "Cargando" })).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});
test("confirmed save notification waits for long refresh and keeps six usable seconds with hover and focus pauses", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-10-11T12:00:00Z") });
  await page.goto("/?success=1"); await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.locator("dialog:not(.global-loading)").getByRole("button", { name: "Guardar cambios" }).click();
  await page.evaluate(() => window.loadingHarness.settle());
  const loader = page.getByRole("dialog", { name: "Cargando" });
  await expect(loader.getByRole("heading")).toHaveText("Consultando clientes…");
  await page.clock.pauseAt(new Date("2026-10-11T12:00:30Z"));
  await expect(page.getByRole("button", { name: "Cerrar notificación" })).toHaveCount(0);
  await page.evaluate(() => window.loadingHarness.unmount()); await expect(loader).toHaveCount(0);
  const status = page.getByRole("status"), close = page.getByRole("button", { name: "Cerrar notificación" });
  await expect(status).toHaveText("Cliente actualizadoConfirmado"); await expect(status).toHaveAttribute("aria-live", "polite");
  await page.clock.fastForward(2000); await close.hover(); await close.focus();
  await page.clock.fastForward(9000); await page.mouse.move(1, 1);
  await page.clock.fastForward(9000); await expect(status).toBeVisible(); await expect(close).toBeFocused();
  await page.getByRole("button", { name: "Editar", exact: true }).focus();
  await page.clock.fastForward(3999); await expect(status).toBeVisible();
  await page.clock.fastForward(1); await expect(status).toHaveCount(0);
  expect(await page.evaluate(() => window.loadingHarness.calls())).toBe(1);
});
test("a partially read notification resumes remaining life without retaining hidden hover or stealing focus", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-10-11T12:00:00Z") }); await page.goto("/");
  await page.clock.pauseAt(new Date("2026-10-11T12:00:30Z"));
  await page.getByRole("button", { name: "Notificar" }).click();
  const close = page.getByRole("button", { name: "Cerrar notificación" });
  await page.clock.fastForward(2000); await close.hover(); await close.focus();
  await page.evaluate(() => window.loadingHarness.overlap());
  const loader = page.getByRole("dialog", { name: "Cargando" }); await expect(loader).toBeFocused();
  await expect(close).toHaveCount(0); await page.clock.fastForward(9000);
  await page.evaluate(() => window.loadingHarness.unmount()); await expect(loader).toHaveCount(0);
  await expect(close).not.toBeFocused();
  await close.hover(); await close.focus(); await page.clock.fastForward(9000);
  await page.mouse.move(1, 1); await page.clock.fastForward(9000); await expect(close).toBeVisible();
  await page.getByRole("button", { name: "Notificar" }).focus();
  await page.clock.fastForward(3999); await expect(close).toBeVisible();
  await page.clock.fastForward(1); await expect(close).toHaveCount(0);
  expect(await page.evaluate(() => window.loadingHarness.calls())).toBe(0);
});
test("named long write wait remains protected and reflows at every target width", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.locator("dialog:not(.global-loading)").getByRole("button", { name: "Guardar cambios" }).click();
  const loader = page.getByRole("dialog", { name: "Cargando" });
  await expect(loader.getByRole("heading")).toHaveText("Guardando cliente…");
  await expect(loader.getByText(/No vuelvas a enviar/)).toBeVisible({ timeout: 12000 });
  for (const width of [390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 450 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const panel = await loader.getByRole("status").boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(0); expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape"); await expect(loader).toBeFocused();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(loader.getByRole("status")).toHaveCSS("transform", "none");
  await page.evaluate(() => window.loadingHarness.settle()); await expect(loader).toHaveCount(0);
});
test("recovery and an announced toast remain keyboard accessible and reflow without overflow", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Error de página" }).click();
  await expect(page.getByRole("heading", { name: "No pudimos mostrar esta página" })).toBeVisible();
  await page.getByRole("button", { name: "Reintentar carga" }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading")).toHaveCount(0);
  await page.getByRole("button", { name: "Página ausente" }).click();
  await expect(page.getByRole("link", { name: "Volver a clientes" })).toHaveAttribute("href", "/clientes");
  await page.getByRole("button", { name: "Notificar" }).click();
  const close = page.getByRole("button", { name: "Cerrar notificación" }); await close.focus();
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
  await expect(close.locator("..")).toHaveCSS("transform", "none");
  for (const width of [390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 450 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = (await close.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(close).toBeFocused(); await expect(close).toHaveCSS("outline-color", "rgb(140, 180, 255)");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(close.locator("..")).toHaveCSS("transform", "none");
  await page.keyboard.press("Enter"); await expect(close).toHaveCount(0);
});
