import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { parseEnv } from "node:util";
import { expect, test } from "@playwright/test";

test("real dashboard SSR, controls and responsive keyboard access without client writes", async ({ browser }) => {
  const names = ["CRM_OWNER_EMAIL", "CRM_OWNER_PASSWORD", "NEXT_PUBLIC_SUPABASE_URL", "CRM_LIVE_PROJECT_REF"];
  const lines: string[] = [];
  for await (const line of createInterface({ input: createReadStream(".env"), crlfDelay: Infinity })) {
    if (names.includes(/^\s*(?:export\s+)?([A-Z_]+)\s*=/.exec(line)?.[1] ?? "")) lines.push(line);
  }
  const env = parseEnv(lines.join("\n"));
  for (const name of names) if (process.env[name]) env[name] = process.env[name]!;
  for (const name of names) expect(Boolean(env[name]), `Falta ${name}`).toBe(true);
  expect(new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe(`${env.CRM_LIVE_PROJECT_REF}.supabase.co`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Tokyo" });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await page.evaluate(({ email, password }) => {
      (document.querySelector('input[name="email"]') as HTMLInputElement).value = email;
      (document.querySelector('input[name="password"]') as HTMLInputElement).value = password;
    }, { email: env.CRM_OWNER_EMAIL!, password: env.CRM_OWNER_PASSWORD! });
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await expect(page.getByLabel("Hasta", { exact: true })).toHaveValue(today);
    expect(Math.round((await page.getByLabel("Desde", { exact: true }).boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    expect((await page.getByRole("button", { name: "Aplicar rango" }).boundingBox())?.height).toBe(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const loaded = await page.getByRole("region", { name: "Contactados", exact: true }).count() === 1;
    if (loaded) {
      await expect(page.getByText("Todavía no hay actividad", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Contactados en el rango seleccionado")).toHaveText("0");
      const firstChart = page.locator('.recharts-surface[role="application"]').first();
      await expect(firstChart).toBeVisible(); await firstChart.focus(); await page.keyboard.press("ArrowRight");
      await expect(page.locator(".recharts-tooltip-wrapper").first()).toBeVisible();
      const summary = page.getByText("Ver datos por período", { exact: true }).first();
      await summary.focus(); await page.keyboard.press("Enter");
      await expect(page.getByRole("table", { name: "Hitos por período" }).locator("tbody tr")).toHaveCount(7);
      console.log("Dashboard actual empty history: confirmed totals, Recharts keyboard tooltip and seven table periods.");
    } else {
      await expect(page.locator("main").getByRole("alert")).toContainText("No pudimos cargar las métricas");
      await expect(page.getByRole("region", { name: "Contactados", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Reintentar" }).click();
      await expect(page.locator("main").getByRole("alert")).toContainText("No pudimos cargar las métricas");
      console.log("Dashboard unavailable while aggregation migration is absent; no zero totals or chart proof claimed.");
    }
    const appliedURL = page.url();
    await page.getByLabel("Desde", { exact: true }).fill("2026-09-01");
    await page.getByRole("button", { name: "Mes", exact: true }).click();
    await expect(page).toHaveURL(appliedURL);
    await expect(page.getByLabel("Desde", { exact: true })).toHaveValue("2026-09-01");
    await page.getByLabel("Desde", { exact: true }).fill("2026-09-01");
    await page.getByLabel("Hasta", { exact: true }).fill("2026-10-09");
    await page.getByRole("button", { name: "Aplicar rango" }).focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/desde=2026-09-01&hasta=2026-10-09&agrupacion=month/);
    await page.getByRole("button", { name: "Año", exact: true }).click(); await expect(page).toHaveURL(/agrupacion=month/);
    await page.getByRole("button", { name: "Aplicar rango" }).click(); await expect(page).toHaveURL(/agrupacion=year/);
    await page.goto("/dashboard?desde=2026-10-09&hasta=2026-10-07&agrupacion=day");
    await expect(page.locator("main").getByRole("alert")).toContainText("Revisá el rango");
    await expect(page.getByLabel("Desde", { exact: true })).toHaveValue("2026-10-09");
    await expect(page.getByLabel("Hasta", { exact: true })).toHaveValue("2026-10-07");
    await page.setViewportSize({ width: 390, height: 1000 });
    const fromBox = await page.getByLabel("Desde", { exact: true }).boundingBox(), untilBox = await page.getByLabel("Hasta", { exact: true }).boundingBox();
    expect(fromBox!.width).toBeGreaterThan(0); expect(untilBox!.width).toBeGreaterThan(0); expect(fromBox?.y).toBe(untilBox?.y);
    expect(untilBox!.x + untilBox!.width).toBeLessThanOrEqual(390);
    const applyBox = await page.getByRole("button", { name: "Aplicar rango" }).boundingBox();
    expect(applyBox!.y).toBeGreaterThan(fromBox!.y + fromBox!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Cuenta · Socio" }).click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click(); await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard"); await expect(page).toHaveURL(/\/login\?reason=expired$/);
  } finally { await context.close(); }
});
