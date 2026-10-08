import { randomUUID } from "node:crypto";
import { expect, type Page, type Route } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isClient, STATUSES, UUID, type Client } from "../../src/lib/clients/model";
import type { MoveIntent } from "../../src/lib/clients/moves";
import type { TrackedRequest } from "./clients-live-recovery";

type FixtureContext = { page: Page; prefix: string; users: SupabaseClient[]; actorIds: string[];
  requests: TrackedRequest[]; fixtures: Map<string, Client>; request: (index: number, id?: string, clientId?: string | null) => string;
  remember: (value: unknown) => void; current: (id: string) => Promise<Client>; read: (query: string) => Promise<Record<string, unknown>[]> };

export function parseMoveAction(body: string | null, fixtures: Map<string, Client>, prefix: string): MoveIntent {
  const args = JSON.parse(body ?? "null"), intent = args?.[0] as MoveIntent;
  if (!Array.isArray(args) || args.length !== 1 || !intent || Object.keys(intent).length !== 5 ||
    typeof intent.requestId !== "string" || !UUID.test(intent.requestId) || typeof intent.clientId !== "string" ||
    !fixtures.get(intent.clientId)?.name.startsWith(`${prefix}-`) || !Number.isSafeInteger(intent.version) ||
    intent.version < 1 || intent.version >= Number.MAX_SAFE_INTEGER || !STATUSES.includes(intent.from) ||
    !STATUSES.includes(intent.to) || intent.from === intent.to)
    throw new Error("Unknown server-action intention; request blocked before execution");
  return intent;
}
export function trackMoveIntent(intent: MoveIntent, seen: Map<string, string>, record: (intent: MoveIntent) => void) {
  const envelope = JSON.stringify(intent), prior = seen.get(intent.requestId);
  if (prior && prior !== envelope) throw new Error("Retry envelope changed; request blocked before execution");
  if (!prior) { record(intent); seen.set(intent.requestId, envelope); }
}

// The shared reviewed harness owns setup (two fixtures maximum), recovery, cleanup and sign-outs.
// This procedure never issues administrative writes or changes credentials/configuration.
export async function runKanbanLiveFlow({ page, prefix, users, actorIds, requests, fixtures, request, remember, current, read }: FixtureContext) {
  const owner = [...fixtures.values()].find((row) => row.status === "Cerrado")!;
  expect(Boolean(owner)).toBe(true);
  const id = owner.id, seen = new Map<string, string>();
  let trackingFailure: Error | undefined, loseNextResponse = false, allowManualEdit = false;
  const actionIntents: MoveIntent[] = [];
  const intercept = async (route: Route) => {
    const req = route.request(), headers = await req.allHeaders();
    if (req.method() !== "POST" || !headers["next-action"]) return route.continue();
    if (allowManualEdit && headers["content-type"]?.startsWith("multipart/form-data")) return route.continue();
    try {
      const intent = parseMoveAction(req.postData(), fixtures, prefix);
      trackMoveIntent(intent, seen, (value) => request(0, value.requestId, value.clientId));
      actionIntents.push(intent);
      if (!loseNextResponse) return route.continue();
      loseNextResponse = false;
      // Commit at the real server, then discard only the browser response: the retry must replay.
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      const committed = await read(`SELECT response FROM crm_private.client_requests WHERE actor_id='${actorIds[0]}'::uuid AND request_id='${intent.requestId}'::uuid`);
      expect(committed).toHaveLength(1);
      const row = committed[0].response;
      expect(isClient(row) && row.id === intent.clientId && row.status === intent.to && row.version === intent.version + 1).toBe(true);
      await route.abort("failed");
    } catch (error) {
      trackingFailure = error instanceof Error ? error : new Error("Tracking failed");
      await route.abort("failed");
    }
  };
  await page.route("**/clientes*", intercept);
  const assertTracked = () => { if (trackingFailure) throw trackingFailure; };
  const handle = () => page.getByRole("button", { name: `Cambiar estado de ${owner.name}`, exact: true });
  const board = page.getByRole("region", { name: "Kanban de clientes" });
  const column = (status: string) => board.locator(`[data-column="${status}"]`);
  const keyboardMove = async (steps: string[], end = "Space") => {
    let index = STATUSES.indexOf(await handle().evaluate((element) => element.closest<HTMLElement>("[data-column]")!.dataset.column) as typeof STATUSES[number]);
    await handle().focus(); await page.keyboard.press("Space");
    await expect(handle()).toHaveAttribute("aria-pressed", "true");
    for (const step of steps) {
      index += step === "ArrowRight" ? 1 : -1;
      await page.keyboard.press(step);
      await expect(page.locator('[id^="DndLiveRegion"]')).toContainText(`Destino: ${STATUSES[index]}.`);
    }
    await page.keyboard.press(end);
  };
  const pointerDrop = async (target: { x: number; y: number }) => {
    const start = await handle().boundingBox(); expect(start).not.toBeNull();
    await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
    await page.mouse.down(); await page.mouse.move(start!.x + start!.width / 2 + 12, start!.y + start!.height / 2, { steps: 3 });
    await page.mouse.move(target.x, target.y, { steps: 10 }); await page.mouse.up();
  };
  try {
    await page.goto(`/clientes?nombre=${encodeURIComponent(prefix)}`);
    await expect(board).toBeVisible(); await expect(board.locator("[data-column]")).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const beforeNoops = requests.length;
    await keyboardMove(["ArrowRight"], "Escape");
    await expect(handle()).toBeFocused();
    await keyboardMove([]);
    const otherColumn = await column("Contactado").boundingBox(); expect(otherColumn).not.toBeNull();
    // Outside every column but nearest a different state: closestCenter alone would cause a write.
    await pointerDrop({ x: otherColumn!.x + otherColumn!.width / 2, y: otherColumn!.y - 30 });
    await expect(handle()).toBeEnabled();
    await expect(page.getByText("Guardando cambio de estado…", { exact: true })).toHaveCount(0);
    expect(requests.length).toBe(beforeNoops); expect((await current(id)).version).toBe(owner.version);
    const destination = column("Interesado"); await destination.scrollIntoViewIfNeeded();
    const target = await destination.boundingBox(); expect(target).not.toBeNull();
    await pointerDrop({ x: target!.x + target!.width / 2, y: target!.y + 100 });
    await expect(page.getByText("Cambio de estado guardado.", { exact: true })).toBeVisible(); assertTracked();
    let saved = await current(id);
    expect(saved.status === "Interesado" && saved.version === owner.version + 1 && saved.contact_at === owner.contact_at && saved.meeting_at === owner.meeting_at).toBe(true);
    await page.reload(); await expect(column("Interesado").getByText(owner.name, { exact: true })).toBeVisible();

    // Simulate loss after commit, then prove same request replay does not repeat the mutation.
    loseNextResponse = true;
    await keyboardMove(["ArrowLeft"]);
    await expect(board.getByRole("alert")).toContainText("No podemos confirmar"); assertTracked();
    await expect(column("Interesado").getByText(owner.name, { exact: true })).toBeVisible();
    const committed = await current(id); expect(committed.status === "Respuesta negativa" && committed.version === saved.version + 1).toBe(true);
    const lostIntent = actionIntents.at(-1)!;
    const ledger = await read(`SELECT response FROM crm_private.client_requests WHERE actor_id='${actorIds[0]}'::uuid AND request_id='${lostIntent.requestId}'::uuid`);
    expect(ledger).toHaveLength(1); expect(ledger[0].response).toEqual(committed);
    await expect(page.getByRole("link", { name: "Tabla", exact: true })).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: "Intentar de nuevo" }).click();
    await expect(page.getByText("Cambio de estado guardado.", { exact: true })).toBeVisible(); assertTracked();
    expect(actionIntents.at(-1)).toEqual(actionIntents.at(-2));
    expect((await current(id)).version).toBe(committed.version);

    // The browser keeps its old version while the other authenticated member updates it.
    const partnerRequest = request(1, randomUUID(), id);
    const partner = await users[1].rpc("update_client", { p_request_id: partnerRequest, p_client_id: id,
      p_expected_version: committed.version, p_payload: { status: "Interesado", notes: "Fixture: edición del socio" } });
    expect(partner.error).toBeNull(); remember(partner.data);
    await keyboardMove(["ArrowLeft"]);
    await expect(board.getByRole("alert")).toContainText("versión confirmada"); assertTracked();
    const stale = actionIntents.at(-1)!;
    // Confirm the exact same owned stale request through the provider, rather than classifying a timeout as rollback.
    const staleRpc = await users[0].rpc("update_client", { p_request_id: stale.requestId, p_client_id: stale.clientId,
      p_expected_version: stale.version, p_payload: { status: stale.to } });
    expect(staleRpc.status).toBe(409); expect(staleRpc.error?.code).toBe("PT409");
    expect(staleRpc.error?.message).toBe("client_version_conflict"); expect(staleRpc.data).toBeNull();
    requests.find((row) => row.actor === actorIds[0] && row.id === stale.requestId)!.rolledBack = true;
    saved = await current(id); expect(saved.version === committed.version + 1 && saved.status === "Interesado" && saved.notes === "Fixture: edición del socio").toBe(true);
    await expect(page.getByRole("link", { name: "Volver a editar" })).toBeVisible();
    await expect(column("Interesado").getByText(owner.name, { exact: true })).toBeVisible();
    await page.reload();
    await keyboardMove(["ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft"]);
    await expect(page.getByText("Cambio de estado guardado.", { exact: true })).toBeVisible(); assertTracked();
    expect((await current(id)).status).toBe("Reunión agendada");
    await keyboardMove(["ArrowRight"]);
    await expect(column("Cerrado").getByText(owner.name, { exact: true })).toBeVisible(); assertTracked();
    // The card moves optimistically; only terminal success releases the intent after RPC confirmation.
    await expect(page.getByText("Cambio de estado guardado.", { exact: true })).toBeVisible();
    await expect(handle()).toBeEnabled();
    saved = await current(id); expect(saved.status).toBe("Cerrado");
    const milestones = await read(`SELECT status,count(*) AS count FROM public.client_milestones WHERE client_id='${id}'::uuid GROUP BY status`);
    expect(milestones).toHaveLength(3); expect(milestones.every((row) => Number(row.count) === 1)).toBe(true);

    // Both views retain the same contact/status/name query; selector is display-only on mobile.
    const params = new URLSearchParams({ nombre: prefix, estado: "Cerrado", desde: "2026-10-07", hasta: "2026-10-07" });
    await page.goto(`/clientes?${params}`); await expect(board.locator("[data-client]")).toHaveCount(1);
    await page.getByRole("link", { name: "Tabla", exact: true }).click();
    await expect(page.getByRole("table", { name: "Clientes" }).locator("tbody tr")).toHaveCount(1);
    expect(new URL(page.url()).searchParams.get("estado")).toBe("Cerrado");
    await page.getByRole("link", { name: "Kanban", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 960 });
    await page.getByRole("combobox", { name: "Estado visible" }).selectOption("Cerrado");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const state of STATUSES) expect(await column(state).isVisible()).toBe(state === "Cerrado");
    expect((await column("Cerrado").boundingBox())!.width).toBeCloseTo(358, 0);
    expect((await board.locator(`[data-client="${id}"]`).boundingBox())!.width).toBeCloseTo(326, 0);
    await page.getByRole("link", { name: `Editar ${owner.name}`, exact: true }).click();
    await page.getByRole("link", { name: "Cancelar", exact: true }).click();
    await expect(page).toHaveURL(/\/clientes\?/); await expect(board).toBeVisible();
    expect([...new URL(page.url()).searchParams]).toEqual([...params]);
    await page.getByRole("combobox", { name: "Estado visible" }).selectOption("Cerrado");
    await page.getByRole("link", { name: `Editar ${owner.name}`, exact: true }).click();
    await page.getByLabel("Estado", { exact: true }).selectOption("Interesado");
    request(0, await page.locator('[name="request_id"]').inputValue(), id); allowManualEdit = true;
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.locator('[name="version"]')).toHaveValue(String(saved.version + 1));
    allowManualEdit = false; expect((await current(id)).status).toBe("Interesado");
    await page.getByRole("link", { name: "Cancelar", exact: true }).click();
    await expect(page).toHaveURL(/\/clientes\?/); await expect(board).toBeVisible();
    await expect(page.getByText("No hay clientes que coincidan con los filtros.")).toBeVisible();
    expect([...new URL(page.url()).searchParams]).toEqual([...params]); assertTracked();
  } catch (error) {
    if (actionIntents.length) console.log("TASK-006 recovery intent:", JSON.stringify(actionIntents.at(-1)));
    throw error;
  } finally { await page.unroute("**/clientes*", intercept); }
}
