import { expect, test } from "@playwright/test";

// Real browser + Next production server. No Auth mocks or provisioned account assertions.
test("anonymous private navigation redirects without caching protected content", async ({ page, request }) => {
  const response = await request.get("/dashboard", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/login?reason=expired");
  expect(response.headers()["cache-control"]).toContain("no-store");
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?reason=expired$/);
  await expect(page.getByRole("heading", { name: "Ingresar al CRM" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Tu sesión finalizó. Ingresá para continuar.");
  await expect(page.getByRole("link", { name: "Registrarse" })).toHaveCount(0);
});

test("native validation, labels and focus work without contacting Auth", async ({ page }) => {
  const authRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/auth/v1/")) authRequests.push(request.url()); });
  await page.goto("/login");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByLabel("Email")).toBeFocused();
  expect(await page.getByLabel("Email").evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await page.getByLabel("Email").fill("member@example.invalid");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Contraseña")).toBeFocused();
  await expect(page.getByLabel("Contraseña")).toHaveAttribute("type", "password");
  expect(authRequests).toEqual([]);
});

test("denied UI offers functional local logout without a supplied identity", async ({ page }) => {
  await page.goto("/login?reason=denied");
  await expect(page.locator(".auth-error[role=alert]")).toHaveText("Esta cuenta no tiene acceso al CRM.");
  await expect(page.getByText("Ingresá con una de las dos cuentas autorizadas.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toBeVisible();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 960 }]) {
  test(`DESIGN-2 login geometry and controls at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    const panel = page.locator(".login-panel");
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(2);
    expect(box!.width).toBe(viewport.width === 1440 ? 420 : 342);
    const styles = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, radius: style.borderRadius, padding: style.paddingTop };
    });
    expect(styles).toEqual({ background: "rgb(18, 31, 53)", radius: "10px", padding: viewport.width === 1440 ? "32px" : "24px" });
    const input = await page.getByLabel("Email").boundingBox();
    const button = await page.getByRole("button", { name: "Ingresar" }).boundingBox();
    expect(input!.height).toBe(44);
    expect(button!.height).toBe(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
