import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { parseEnv } from "node:util";
import { expect, test } from "@playwright/test";

test("real SSR form geometry, timezone and server validation without client writes", async ({ browser }) => {
  const names = ["CRM_OWNER_EMAIL", "CRM_OWNER_PASSWORD", "NEXT_PUBLIC_SUPABASE_URL", "CRM_LIVE_PROJECT_REF"];
  const lines: string[] = [];
  for await (const line of createInterface({ input: createReadStream(".env"), crlfDelay: Infinity })) {
    if (names.includes(/^\s*(?:export\s+)?([A-Z_]+)\s*=/.exec(line)?.[1] ?? "")) lines.push(line);
  }
  const env = { ...parseEnv(lines.join("\n")) };
  for (const name of names) if (process.env[name]) env[name] = process.env[name]!;
  for (const name of names) expect(Boolean(env[name]), `Falta ${name}`).toBe(true);
  expect(new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname === `${env.CRM_LIVE_PROJECT_REF}.supabase.co`).toBe(true);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Tokyo" });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await page.evaluate(({ email, password }) => {
      (document.querySelector('input[name="email"]') as HTMLInputElement).value = email;
      (document.querySelector('input[name="password"]') as HTMLInputElement).value = password;
    }, { email: env.CRM_OWNER_EMAIL!, password: env.CRM_OWNER_PASSWORD! });
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/clientes/nuevo?returnTo=%2Fclientes%3Fnombre%3DUIcheck");
    await expect(page.getByRole("heading", { name: "Nuevo cliente" })).toBeVisible();
    const panel = await page.getByRole("dialog", { name: "Nuevo cliente" }).boundingBox();
    expect(panel?.width).toBeCloseTo(800, 0);
    const nameBox = await page.getByLabel("Nombre *").boundingBox();
    const companyBox = await page.getByLabel("Empresa").boundingBox();
    expect(nameBox?.y).toBe(companyBox?.y);
    expect(nameBox?.height).toBe(44);
    expect(await page.getByLabel("Fecha de contacto *").inputValue()).toBe(
      new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit",
        day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).replace(" ", "T"));
    await expect(page.getByRole("link", { name: "Clientes", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByLabel("Email").fill("broken");
    // Name remains empty: every submission below is invalid before any mutation RPC.
    await page.getByRole("button", { name: "Crear cliente" }).click();
    await expect(page.locator('section [role="alert"]')).toHaveText("Revisá los campos indicados.");
    await expect(page.locator("#name-error")).toHaveText("Ingresá el nombre del cliente.");
    await expect(page.locator("#email-error")).toHaveText("Ingresá un email válido.");
    await expect(page.getByLabel("Email")).toHaveValue("broken");
    await page.setViewportSize({ width: 390, height: 960 });
    expect((await page.getByRole("dialog", { name: "Nuevo cliente" }).boundingBox())?.width).toBeCloseTo(366, 0);
    const mobileName = await page.getByLabel("Nombre *").boundingBox();
    const mobileCompany = await page.getByLabel("Empresa").boundingBox();
    expect(mobileCompany!.y).toBeGreaterThan(mobileName!.y + mobileName!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page).toHaveURL(/\/clientes\?nombre=UIcheck$/);
    const board = page.getByRole("region", { name: "Kanban de clientes" });
    await expect(board).toBeVisible();
    const visible = page.getByRole("combobox", { name: "Estado visible" });
    await visible.selectOption("Interesado");
    await expect(board.locator('[data-column="Interesado"]')).toBeVisible();
    await expect(board.locator('[data-column="Contactado"]')).toBeHidden();
    expect((await board.locator('[data-column="Interesado"]').boundingBox())!.width).toBeCloseTo(358, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(visible).toBeHidden();
    for (const column of await board.locator("[data-column]").all()) await expect(column).toBeVisible();
    expect(await board.locator("[data-column]").count()).toBe(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const strip = board.locator("[data-column]").first().locator("..");
    expect(await strip.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await page.getByRole("radio", { name: "Tabla", exact: true }).click();
    await expect(page).toHaveURL(/\/clientes\?nombre=UIcheck&vista=tabla$/);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/clientes/nuevo");
    await expect(page).toHaveURL(/\/login\?reason=expired$/);
  } finally { await context.close(); }
});
