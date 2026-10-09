import { expect, test, type Page } from "@playwright/test";
import { crmLiveAccounts } from "../support/crm-live";

// Keep the real Next response/router, substituting only the provider result.
function unavailableFlight(body: string) {
  let replaced = 0;
  const next = body.split("\n").map((line) => {
    const match = /^([a-f\d]+:)([\[{].*)$/.exec(line);
    if (!match) return line;
    try {
      const value = JSON.parse(match[2], (_key, value) => {
        if (value?.kind === "found" && value.filters && value.rows) {
          replaced++; return { kind: "unavailable", filters: value.filters };
        }
        if (["ready", "too_many_buckets"].includes(value?.kind) && value.metrics) {
          replaced++; return { kind: "unavailable", query: { from: value.from, until: value.until, grouping: value.grouping } };
        }
        return value;
      });
      return match[1] + JSON.stringify(value);
    } catch { return line; }
  }).join("\n");
  expect(replaced, "A real loaded result was replaced with an unavailable provider result").toBeGreaterThan(0);
  return next;
}

async function session(page: Page) {
  const blocked: string[] = [], reads: string[] = [];
  let failure = false, release: (() => void) | undefined;
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url()), headers = await request.allHeaders();
    if (request.method() !== "GET" && request.method() !== "HEAD" && url.pathname !== "/login") {
      blocked.push(url.pathname); await route.abort("blockedbyclient"); return;
    }
    if (headers["next-router-prefetch"]) { await route.abort(); return; }
    if (headers.rsc && ["/clientes", "/dashboard"].includes(url.pathname)) {
      reads.push(url.pathname);
      if (failure) {
        failure = false;
        await new Promise<void>((resolve) => { release = resolve; });
        const response = await route.fetch();
        await route.fulfill({ response, body: unavailableFlight(await response.text()) });
        return;
      }
    }
    await route.continue();
  });
  const account = (await crmLiveAccounts())[0];
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { blocked, reads, failNext: () => { failure = true; }, finish: () => release?.() };
}

test("views use the loaded page, history and reload; filters still request data", async ({ page }) => {
  const checks = await session(page);
  await page.goto("/clientes?vista=tabla");
  const rows = await page.getByRole("table", { name: "Clientes" }).locator("tbody tr").count();
  const baseline = checks.reads.length;
  await page.getByRole("radio", { name: "Kanban", exact: true }).click();
  await expect(page.getByRole("region", { name: "Kanban de clientes" })).toBeVisible();
  await expect(page).toHaveURL(/\/clientes$/);
  await page.getByRole("radio", { name: "Tabla", exact: true }).click();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(rows);
  await page.goBack();
  await expect(page.getByRole("region", { name: "Kanban de clientes" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("table", { name: "Clientes" })).toBeVisible();
  expect(checks.reads).toHaveLength(baseline);
  await page.reload();
  await expect(page.getByRole("radio", { name: "Tabla", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Filtros de clientes" }).click();
  await page.getByLabel("Nombre").fill("TASK001-no-match");
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page).toHaveURL(/nombre=TASK001-no-match/);
  await expect(page.getByText("No hay clientes que coincidan con los filtros.")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("vista")).toBe("tabla");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("radio", { name: "Kanban", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Estado visible" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(checks.blocked).toEqual([]);
});

for (const destination of ["clientes", "dashboard"] as const) {
  test(`${destination} refresh keeps parameters and data through failure, rejects duplicates and retries`, async ({ page }) => {
    const checks = await session(page);
    await page.goto(destination === "clientes" ? "/clientes?vista=tabla" : "/dashboard?desde=2026-10-01&hasta=2026-10-08&agrupacion=month");
    const url = page.url(), before = checks.reads.length;
    const contents = destination === "clientes" ? page.getByRole("table", { name: "Clientes" }) : page.getByRole("region", { name: "Contactados", exact: true });
    const lastData = await contents.textContent();
    checks.failNext();
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(/Actualizando/);
    await expect(page.getByRole("button", { name: "Actualizando…", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Actualizando…", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect.poll(() => checks.reads.length).toBe(before + 1);
    checks.finish();
    await expect(page.getByRole("alert")).toHaveText(/No pudimos actualizar/);
    expect(await contents.textContent()).toBe(lastData);
    await expect(page).toHaveURL(url);
    await page.getByRole("button", { name: "Reintentar actualización", exact: true }).click();
    await expect(page.getByRole("button", { name: "Actualizar", exact: true })).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(checks.reads).toHaveLength(before + 2);
    await expect(page).toHaveURL(url);
    expect(checks.blocked).toEqual([]);
  });
}
