import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-client-delete",
    optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false, include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"] },
    server: { host: "127.0.0.1", port: 3117, strictPort: true }, resolve: { alias: { "@": resolve("src") } },
    plugins: [react(), { name: "loading-boundaries", enforce: "pre",
      resolveId(id) { if (["next/link", "next/navigation"].includes(id)) return `\0${id}`; },
      load(id) {
        if (id === "\0next/navigation") return "export const useRouter=()=>({replace(){},push(){}});";
        if (id === "\0next/link") return "import {createElement} from 'react';export default function Link({prefetch,onNavigate,...props}){return createElement('a',props)}";
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (new URL(request.url!, "http://local.invalid").pathname !== "/") return next();
        response.setHeader("Content-Type", "text/html"); response.end(await vite.transformIndexHtml("/", '<html lang="es"><body><div id="root"></div><script type="module" src="/tests/e2e/client-delete-harness.tsx"></script></body></html>'));
      }); },
    }] }); await server.listen();
});
test.afterAll(async () => { await server?.close(); });
for (const mobile of [false, true]) test(`continuous hold and confirmed retry mobile=${mobile}`, async ({ page }) => {
  if (mobile) { await page.setViewportSize({ width: 390, height: 700 }); await page.emulateMedia({ reducedMotion: "reduce" }); }
  await page.goto("/"); await page.getByRole("button", { name: "Editar", exact: true }).focus(); await page.getByRole("button", { name: "Editar", exact: true }).click();
  const hold = page.getByRole("button", { name: "Mantener para borrar", exact: true });
  await hold.scrollIntoViewIfNeeded();
  expect((await hold.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await hold.focus(); await hold.evaluate(async (button) => {
    button.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 800));
    button.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
  });
  expect(await page.evaluate(() => window.deletionHarness.calls.length)).toBe(0);
  if (mobile) {
    await hold.evaluate(async (button) => {
      button.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 2, pointerType: "touch", isPrimary: true, button: 0, bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 800));
      button.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 2, pointerType: "touch", isPrimary: true, bubbles: true }));
    });
    expect(await page.evaluate(() => window.deletionHarness.calls.length)).toBe(0);
    const touch = await page.context().newCDPSession(page);
    await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await hold.evaluate((button) => button.addEventListener("pointerdown", (event) => { (window as unknown as { trustedTouch: boolean }).trustedTouch = event.isTrusted; }, { once: true }));
    const box = (await hold.boundingBox())!;
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  } else {
    await page.bringToFront(); await hold.focus();
    await hold.evaluate((button) => {
      const events: unknown[] = [];
      (window as unknown as { gestureEvents: unknown[] }).gestureEvents = events;
      for (const type of ["keydown", "keyup", "blur"]) button.addEventListener(type, (event) => events.push({ type, trusted: event.isTrusted, key: (event as KeyboardEvent).key, phase: button.getAttribute("data-phase") }));
      window.addEventListener("blur", () => events.push({ type: "windowblur" }));
    });
    await page.keyboard.down("Enter");
  }
  try { await expect(page.getByRole("dialog", { name: "Cargando" })).toBeVisible(); }
  catch (error) { throw new Error(`${String(error)} ${JSON.stringify(await page.evaluate(() => ({ events: (window as unknown as { gestureEvents: unknown[] }).gestureEvents, phase: document.querySelector('.hb-root')?.getAttribute('data-phase') })))}`); }
  if (mobile) expect(await page.evaluate(() => (window as unknown as { trustedTouch: boolean }).trustedTouch)).toBe(true);
  else { expect(await page.evaluate(() => (window as unknown as { gestureEvents: { trusted?: boolean; type?: string }[] }).gestureEvents.some((event) => event.type === "keydown" && event.trusted))).toBe(true); await page.keyboard.up("Enter"); }
  await expect(page.getByText("Cliente eliminado", { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.deletionHarness.settle());
  await expect(page.getByRole("alert")).toHaveText("Sin confirmar");
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  await page.getByRole("button", { name: "Reintentar borrado" }).click();
  await expect(page.getByRole("dialog", { name: "Cargando" })).toBeVisible();
  expect(await page.evaluate(() => window.deletionHarness.calls[0] === window.deletionHarness.calls[1])).toBe(true);
  await page.evaluate(() => window.deletionHarness.settle());
  await expect(page.getByRole("status")).toContainText("Cliente eliminado");
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeFocused();
});
