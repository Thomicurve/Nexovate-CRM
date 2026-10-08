import { expect, test } from "@playwright/test";
import { crmLiveAccounts, tabTo } from "../support/crm-live";

for (const accountIndex of [0, 1]) {
  test(`member ${accountIndex + 1} uses integrated navigation and keyboard on desktop/mobile without business writes`, async ({ browser }) => {
    test.setTimeout(120_000);
    const account = (await crmLiveAccounts())[accountIndex];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const blocked: string[] = [];
    let loggingOut = false;
    await context.route("**/*", async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === "POST" && (url.pathname.startsWith("/rest/v1/rpc/") ||
        url.origin === "http://127.0.0.1:3000" && url.pathname !== "/login" && !loggingOut)) {
        blocked.push(url.pathname); await route.abort(); return;
      }
      await route.continue();
    });
    try {
      const page = await context.newPage();
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Ingresar al CRM" })).toBeVisible();
      await page.evaluate(({ email, password }) => {
        (document.querySelector('input[name="email"]') as HTMLInputElement).value = email;
        (document.querySelector('input[name="password"]') as HTMLInputElement).value = password;
      }, account);
      await tabTo(page, page.getByLabel("Email"));
      await tabTo(page, page.getByLabel("Contraseña"));
      await tabTo(page, page.getByRole("button", { name: "Ingresar" }));
      await page.keyboard.press("Enter"); await expect(page).toHaveURL(/\/dashboard$/);
      const nav = page.getByRole("navigation", { name: "Navegación principal" });
      const main = page.getByRole("main");
      const activate = async (target: Parameters<typeof tabTo>[1]) => { await tabTo(page, target); await page.keyboard.press("Enter"); };
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(main.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
        for (const title of ["Contactados", "Reuniones agendadas", "Cerrados"]) {
          await expect(main.getByRole("region", { name: title, exact: true })).toBeVisible();
        }
        await expect(main.getByRole("alert")).toHaveCount(0);
        await tabTo(page, main.getByLabel("Desde", { exact: true }));
        await tabTo(page, main.getByLabel("Hasta", { exact: true }));
        await activate(nav.getByRole("link", { name: "Clientes", exact: true }));
        await expect(page).toHaveURL(/\/clientes$/);
        await expect(main.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Clientes", exact: true })).toHaveAttribute("aria-current", "page");
        await expect(main.getByRole("region", { name: "Kanban de clientes" })).toBeVisible();
        await expect(main.getByText("Todavía no hay clientes.", { exact: true })).toBeVisible();
        await expect(main.getByRole("alert")).toHaveCount(0);
        await activate(main.getByRole("link", { name: "Tabla", exact: true }));
        await expect(page).toHaveURL(/vista=tabla/);
        await expect(main.getByRole("link", { name: "Tabla", exact: true })).toHaveAttribute("aria-current", "page");
        await activate(main.getByRole("button", { name: "Filtros de clientes" }));
        const filters = main.getByRole("region", { name: "Filtrar clientes" });
        await expect(filters.getByLabel("Nombre", { exact: true })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(main.getByRole("button", { name: "Filtros de clientes" })).toBeFocused();
        await activate(main.getByRole("button", { name: "Filtros de clientes" }));
        await filters.getByLabel("Nombre", { exact: true }).fill("WU011-readonly");
        await tabTo(page, filters.getByRole("checkbox", { name: "Interesado", exact: true })); await page.keyboard.press("Space");
        await activate(filters.getByRole("button", { name: "Aplicar filtros" }));
        await expect(main.getByText("No hay clientes que coincidan con los filtros.", { exact: true })).toBeVisible();
        const applied = new URL(page.url()).searchParams;
        expect(applied.get("nombre")).toBe("WU011-readonly"); expect(applied.getAll("estado")).toEqual(["Interesado"]);
        await activate(main.getByRole("link", { name: "Kanban", exact: true }));
        await expect(page).not.toHaveURL(/vista=tabla/);
        await expect(main.getByRole("link", { name: "Kanban", exact: true })).toHaveAttribute("aria-current", "page");
        expect(new URL(page.url()).searchParams.get("nombre")).toBe("WU011-readonly");
        expect(new URL(page.url()).searchParams.getAll("estado")).toEqual(["Interesado"]);
        const returnParams = [...new URL(page.url()).searchParams].filter(([, value]) => value).sort();
        await activate(main.getByRole("link", { name: "Nuevo cliente", exact: true }));
        await expect(main.getByRole("heading", { name: "Nuevo cliente" })).toBeVisible();
        for (const label of ["Nombre *", "Empresa", "Email", "Teléfono", "Rubro", "Fecha de contacto *", "Fecha de reunión", "Notas"]) {
          await tabTo(page, main.getByLabel(label, { exact: true }));
        }
        await main.getByLabel("Nombre *", { exact: true }).fill("Borrador sin guardar");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await activate(main.getByRole("link", { name: "Cancelar", exact: true }));
        await expect(page).toHaveURL(/\/clientes\?/);
        expect([...new URL(page.url()).searchParams].filter(([, value]) => value).sort()).toEqual(returnParams);
        await activate(main.getByRole("button", { name: "Filtros de clientes" }));
        await activate(filters.getByRole("link", { name: "Limpiar filtros" }));
        await expect(page).toHaveURL(/\/clientes$/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await activate(nav.getByRole("link", { name: "Dashboard" }));
        await expect(page).toHaveURL(/\/dashboard$/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      loggingOut = true; await activate(nav.getByRole("button", { name: "Cerrar sesión" }));
      await expect(page).toHaveURL(/\/login$/);
      for (const path of ["/dashboard", "/clientes", "/clientes/nuevo"]) {
        await page.goto(path); await expect(page).toHaveURL(/\/login\?reason=expired$/);
      }
      expect(blocked, "No se intentaron escrituras de negocio").toEqual([]);
    } finally { await context.close(); }
  });
}
