import { expect, test } from "@playwright/test";
import { crmLiveAccounts } from "../support/crm-live";
import { assertFeedbackSave, isClientActionUrl } from "./client-feedback-guards";
import { clientId, confirmed, requestId } from "../clients/fixture";

test("offline client action routing blocks unknown and foreign multipart before any backend", async ({ page }) => {
  const actor = "33333333-3333-4333-8333-333333333333", prefix = "WU006-55555555-5555-4555-8555-555555555555";
  const fixtures = new Map([[clientId, { ...confirmed, name: `${prefix}-owner` }]]);
  const requests = [{ actor, id: requestId, clientId }];
  const guarded: string[] = [];
  let backendAttempts = 0;
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST") backendAttempts++;
    await route.fulfill({ contentType: "text/html", body: "<html><body>Offline sentinel</body></html>" });
  });
  await page.route(isClientActionUrl, async (route) => {
    const outgoing = route.request(), headers = await outgoing.allHeaders();
    if (outgoing.method() !== "POST" || !headers["next-action"]) return route.fallback();
    guarded.push(new URL(outgoing.url()).pathname);
    const encoded = new Request("http://local.invalid", { method: "POST", headers: { "content-type": headers["content-type"] },
      body: new Uint8Array(outgoing.postDataBuffer()!) });
    try { assertFeedbackSave(await encoded.formData(), actor, prefix, requests, fixtures); }
    catch { await route.abort("blockedbyclient"); return; }
    await route.fallback();
  });
  await page.goto("http://offline.invalid/sentinel");
  const paths = ["/clientes?vista=tabla", "/clientes/nuevo?returnTo=%2Fclientes", `/clientes/${clientId}/editar?returnTo=%2Fclientes`];
  const results = await page.evaluate(async ({ paths, actor, requestId, clientId, prefix }) => {
    const results = [];
    for (const path of paths) for (const foreign of [false, true]) {
      const form = new FormData();
      // React's multipart action encoding prefixes FormData fields with the argument index.
      form.set("0", '["$K1"]'); form.set("1_request_id", foreign ? requestId : actor);
      form.set("1_client_id", foreign ? actor : clientId); form.set("1_name", `${prefix}-owner`);
      try { await fetch(path, { method: "POST", headers: { "Next-Action": "offline-test-action" }, body: form }); results.push("backend"); }
      catch { results.push("blocked"); }
    }
    return results;
  }, { paths, actor, requestId, clientId, prefix });
  expect.soft(backendAttempts).toBe(0);
  expect(guarded).toEqual(paths.flatMap((path) => [new URL(path, "http://offline.invalid").pathname, new URL(path, "http://offline.invalid").pathname]));
  expect(results).toEqual(Array(6).fill("blocked"));
  expect(backendAttempts).toBe(0);
});

test("feedback presentation, navigation and existing-card drag cancellation without business writes", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  const account = (await crmLiveAccounts())[0];
  const blocked: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "POST" && (url.pathname.startsWith("/rest/v1/") ||
      url.origin === new URL(page.url()).origin && url.pathname !== "/login")) {
      blocked.push(url.pathname); await route.abort(); return;
    }
    await route.continue();
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/clientes");
  const board = page.getByRole("region", { name: "Kanban de clientes" });
  const order = ["Contactado", "Interesado", "Reunión agendada", "Cerrado", "Sin respuesta", "Respuesta negativa"];
  await expect(board.getByRole("heading", { level: 2 })).toHaveText(order);
  await expect(page.getByText("Estado actualizado", { exact: true })).toHaveCount(0);
  const card = board.locator("[data-client]").first();
  if (await card.count()) {
    await card.scrollIntoViewIfNeeded();
    const edit = card.getByRole("button", { name: /^Abrir / });
    const editPath = `/clientes/${await card.getAttribute("data-client")}/editar?returnTo=${encodeURIComponent(new URL(page.url()).pathname + new URL(page.url()).search)}`;
    const body = await card.getByRole("heading").boundingBox(); expect(body).not.toBeNull();
    const origin = await card.evaluate((node) => node.closest<HTMLElement>("[data-column]")!.dataset.column);
    const target = board.locator(`[data-column="${order.find((status) => status !== origin)}"]`);
    await target.scrollIntoViewIfNeeded();
    await card.scrollIntoViewIfNeeded();
    const targetBox = await target.boundingBox(); expect(targetBox).not.toBeNull();
    await page.mouse.move(body!.x + 15, body!.y + 10); await page.mouse.down();
    await page.mouse.move(body!.x + 30, body!.y + 10, { steps: 3 });
    await page.mouse.move(targetBox!.x + 40, targetBox!.y + 90, { steps: 12 });
    await expect(target.getByText("Soltar aquí", { exact: true })).toBeVisible();
    await expect(target).toHaveCSS("background-color", "rgb(23, 50, 81)");
    await expect(card).toHaveCSS("border-top-color", "rgb(166, 202, 255)");
    await page.keyboard.press("Escape"); await page.mouse.up();
    await expect(board.getByText("Soltar aquí", { exact: true })).toHaveCount(0);
    const handle = card.getByRole("button", { name: /^Arrastrar cliente / });
    await handle.focus(); await page.keyboard.press("Space");
    await page.keyboard.press(origin === "Respuesta negativa" ? "ArrowLeft" : "ArrowRight");
    await expect(board.getByText("Soltar aquí", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(handle).toBeFocused();
    const listUrl = page.url();
    await edit.click(); await expect(page.getByRole("dialog", { name: "Editar cliente" })).toBeVisible(); await expect(page).toHaveURL(listUrl);
    await page.goto(`${editPath}&guardado=1`);
    await expect(page.getByText("Cliente guardado.", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Cliente actualizado", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    console.log("TASK009 readonly: existing-card body pointer/cue/Escape/keyboard/Edit verified.");
  } else {
    console.log("TASK009 readonly: portfolio empty; browser drag checks unavailable, covered by real sensors in React tests.");
  }
  await page.setViewportSize({ width: 390, height: 900 });
  const visible = page.getByRole("combobox", { name: "Estado visible" });
  await expect(visible.locator("option")).toHaveText(order.map((status) => new RegExp(`^${status} · \\d+$`)));
  await visible.selectOption("Interesado");
  await expect(board.locator('[data-column="Interesado"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(blocked, "No business mutation was attempted").toEqual([]);
});
