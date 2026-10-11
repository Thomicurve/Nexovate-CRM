import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-crm-shell",
    optimizeDeps: { noDiscovery: true, holdUntilCrawlEnd: false, include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client", "gsap", "@gsap/react"] },
    server: { host: "127.0.0.1", port: 3116, strictPort: true },
    resolve: { alias: { "@": resolve("src") } }, plugins: [react(), {
      name: "local-shell-boundaries", enforce: "pre",
      resolveId(id) { return ["next/link", "next/navigation", "next/image"].includes(id) ? `\0${id}` : undefined; },
      load(id) {
        if (id === "\0next/navigation") return "export const usePathname=()=>location.pathname; export const useRouter=()=>({push: p=>location.assign(p),replace: p=>location.replace(p)});";
        if (id === "\0next/link") return "import {createElement} from 'react'; export default function Link({prefetch,onNavigate,...props}){return createElement('a',props)}";
        if (id === "\0next/image") return "import {createElement} from 'react'; export default function Image(props){return createElement('img',props)}";
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
        if (!["/login", "/clientes", "/dashboard"].includes(new URL(request.url!, "http://local.invalid").pathname)) return next();
        response.setHeader("Content-Type", "text/html");
        response.end(await vite.transformIndexHtml(request.url!, '<html lang="es"><body><div id="root"></div><script type="module" src="/tests/e2e/crm-shell-harness.tsx"></script></body></html>'));
      }); },
    }] });
  await server.listen();
});
test.afterAll(async () => { await server?.close(); });

test("responsive access and shell, keyboard account, focus and reduced motion without external data", async ({ page }) => {
  test.setTimeout(90_000);
  const forbidden: string[] = [];
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== "http://127.0.0.1:3116" || route.request().method() !== "GET") {
      forbidden.push(route.request().url()); await route.abort(); return;
    }
    await route.continue();
  });
  for (const width of [320, 390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Tu cartera. Una sola vista." })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator(".login-panel").evaluate((el) => el.getBoundingClientRect().width <= 400)).toBe(true);
    expect(await page.getByLabel("Email").evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    for (const element of await page.locator("input,button").all()) expect((await element.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.goto("/clientes");
    await expect(page.getByRole("link", { name: "Clientes", exact: true })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Cuenta · Socio" }).click();
    const menu = page.getByRole("menu"); await expect(menu).toBeVisible();
    const bounds = (await menu.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect(page.getByRole("menuitem", { name: "Cerrar sesión" })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cuenta · Socio" })).toBeFocused();
  }
  await page.goto("/login"); await page.getByLabel("Contraseña").fill("synthetic secret");
  await page.getByLabel("Email").focus();
  const contrasts = await page.evaluate(() => {
    function luminance(color: string) {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => {
        const channel = v / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    }
    function ratio(a: string, b: string) {
      const first = luminance(a), second = luminance(b); return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    }
    const input = getComputedStyle(document.querySelector("input")!), button = getComputedStyle(document.querySelector(".primary-button")!);
    const secondary = getComputedStyle(document.querySelector(".secondary")!), body = getComputedStyle(document.body);
    return { text: ratio(body.color, body.backgroundColor), secondary: ratio(secondary.color, body.backgroundColor),
      button: ratio(button.color, button.backgroundColor), field: ratio(input.borderTopColor, input.backgroundColor), focus: ratio(input.outlineColor, input.backgroundColor) };
  });
  expect(contrasts.text).toBeGreaterThanOrEqual(4.5); expect(contrasts.secondary).toBeGreaterThanOrEqual(4.5);
  expect(contrasts.button).toBeGreaterThanOrEqual(4.5); expect(contrasts.field).toBeGreaterThanOrEqual(3); expect(contrasts.focus).toBeGreaterThanOrEqual(3);
  console.log("Measured contrast", contrasts);
  await page.getByRole("button", { name: "Mostrar contraseña" }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "text");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("synthetic secret");
  await page.getByRole("button", { name: "Ocultar contraseña" }).click();
  await page.getByLabel("Email").fill("member@example.invalid"); await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Error simulado. Revisá los datos.");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await page.goto("/clientes"); await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page.getByRole("main")).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const account = page.getByRole("button", { name: "Cuenta · Socio" }); await account.focus(); await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menu")).toHaveCSS("transform", "none"); await expect(page.getByRole("menu")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape"); await expect(account).toBeFocused();
  await page.emulateMedia({ reducedMotion: "no-preference" }); await account.click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("menu")).toHaveCSS("transform", "none"); await expect(page.getByRole("menu")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await account.click(); await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  const loading = page.getByRole("dialog", { name: "Cargando" });
  await expect(loading).toBeVisible(); await expect(loading).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator('.account-menu [role="menuitem"]')).toBeDisabled();
  await page.keyboard.press("Escape"); await page.keyboard.press("Enter");
  await expect(loading).toBeVisible();
  const logoutCalls = () => page.evaluate(() => (window as unknown as { shellHarness: { logoutCalls(): number } }).shellHarness.logoutCalls());
  expect(await logoutCalls()).toBe(1);
  await page.getByRole("main").evaluate((element: HTMLElement) => element.focus()); await expect(loading).toBeFocused();
  await page.evaluate(() => (window as unknown as { shellHarness: { finishLogout(): void } }).shellHarness.finishLogout());
  await expect(loading).toHaveCount(0); await expect(account).toBeFocused(); expect(await logoutCalls()).toBe(1);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await page.getByRole("button", { name: "Salir del harness" }).click(); await expect(page.getByRole("main")).toHaveCount(0);
  expect(forbidden).toEqual([]);
});
