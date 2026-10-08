import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { isClient, UUID, type Client } from "../../src/lib/clients/model";
import { recoverFixtures, finishLiveRun, type TrackedRequest } from "./clients-live-recovery";
import { runKanbanLiveFlow } from "./kanban-live-flow";

// Explicitly privileged fixture mode. This case is absent from ordinary runs;
// focusing this file without the flag fails discovery, rather than reporting skip.
const kanbanRun = process.env.CRM_KANBAN_LIVE_WRITE === "1";
if (kanbanRun && process.env.CRM_CLIENTS_LIVE_WRITE === "1") throw new Error("Choose one authorized fixture mode per run");
if (process.env.CRM_CLIENTS_LIVE_WRITE === "1" || kanbanRun) {
  test(kanbanRun ? "authorized TASK-006 Kanban fixtures with guarded exact cleanup" :
    "authorized two-client CRUD fixtures with guarded exact cleanup", async ({ browser }) => {
    test.setTimeout(120_000);
    const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ACCESS_TOKEN",
      "CRM_LIVE_PROJECT_REF", "CRM_OWNER_EMAIL", "CRM_PARTNER_EMAIL", "CRM_OWNER_PASSWORD", "CRM_PARTNER_PASSWORD"];
    const selected: string[] = [];
    for await (const line of createInterface({ input: createReadStream(".env"), crlfDelay: Infinity })) {
      if (names.includes(/^\s*(?:export\s+)?([A-Z_]+)\s*=/.exec(line)?.[1] ?? "")) selected.push(line);
    }
    const env = parseEnv(selected.join("\n"));
    for (const name of names) if (process.env[name]) env[name] = process.env[name]!;
    for (const name of names) expect(Boolean(env[name]), `Falta ${name}`).toBe(true);
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL!), ref = env.CRM_LIVE_PROJECT_REF!;
    expect(url.protocol === "https:" && /^[a-z0-9]{20}$/.test(ref) && url.hostname === `${ref}.supabase.co`).toBe(true);
    const api = async (path: string, body?: object) => {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
        method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Management HTTP ${response.status}`);
      return response.json();
    };
    const read = (query: string) => api("/database/query/read-only", { query });
    const project = await api("");
    expect(project.id === ref && project.status === "ACTIVE_HEALTHY").toBe(true);
    const baseline = await read("SELECT (SELECT count(*) FROM auth.users) AS users," +
      "(SELECT count(*) FROM public.clients) AS clients,(SELECT count(*) FROM public.client_transitions) AS transitions," +
      "(SELECT count(*) FROM public.client_milestones) AS milestones,(SELECT count(*) FROM public.client_contact_corrections) AS corrections," +
      "(SELECT count(*) FROM crm_private.client_requests) AS ledger," +
      "(SELECT jsonb_agg(jsonb_build_object('slot',slot,'user_id',user_id) ORDER BY slot) FROM public.crm_members) AS members");
    expect(Number(baseline[0].users) === 2 && baseline[0].members.length === 2 &&
      ["clients", "transitions", "milestones", "corrections", "ledger"].every((key) => Number(baseline[0][key]) === 0),
      "Only the reviewed empty CRM baseline is allowed").toBe(true);
    const userClient = () => createClient(url.origin, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
    });
    const users = [userClient(), userClient()];
    const accounts = [{ email: env.CRM_OWNER_EMAIL!, password: env.CRM_OWNER_PASSWORD! },
      { email: env.CRM_PARTNER_EMAIL!, password: env.CRM_PARTNER_PASSWORD! }];
    const actorIds: string[] = [], requests: TrackedRequest[] = [];
    const fixtures = new Map<string, Client>();
    // TASK-006 uses the legacy fixture namespace to preserve the reviewed recovery guard unchanged.
    const prefix = `WU006-${randomUUID()}`;
    const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
    const request = (index: number, id: string = randomUUID(), clientId: string | null = null) => {
      if (!UUID.test(id) || !UUID.test(actorIds[index]) || clientId !== null && !UUID.test(clientId))
        throw new Error("Invalid fixture request identity");
      requests.push({ actor: actorIds[index], id, clientId }); return id;
    };
    const remember = (row: unknown) => {
      expect(isClient(row) && row.name.startsWith(prefix), "Only run-owned fixtures may be tracked").toBe(true);
      if (isClient(row)) fixtures.set(row.id, row);
    };
    const current = async (id: string) => {
      const result = await users[0].from("clients").select("*").eq("id", id).single();
      expect(result.error === null).toBe(true); remember(result.data); return result.data as Client;
    };
    const cleanup = async () => {
      const recovered = await recoverFixtures(prefix, requests, fixtures, async () => {
        if (!requests.length) return [];
        const pairs = requests.map(({ actor, id }) => `(${quote(actor)}::uuid,${quote(id)}::uuid)`).join(",");
        return read(`SELECT actor_id,request_id,envelope,response FROM crm_private.client_requests
          WHERE (actor_id,request_id) IN (${pairs})`);
      }, async (ids) => ids.length ? (await read(`SELECT to_jsonb(c) AS body FROM public.clients c
        WHERE id=ANY(ARRAY[${ids.map(quote).join(",")}]::uuid[])`)).map((row: { body: unknown }) => row.body) : []);
      fixtures.clear();
      for (const [id, row] of recovered) fixtures.set(id, row);
      if (!fixtures.size) return;
      const ids = [...fixtures.keys()];
      if (ids.length > 2 || ids.some((id) => !UUID.test(id)) || requests.some((row) => !UUID.test(row.id) || !UUID.test(row.actor)))
        throw new Error("Cleanup ownership invalid; no deletion");
      const idArray = `ARRAY[${ids.map(quote).join(",")}]::uuid[]`;
      const pairs = requests.map(({ actor, id }) => `(${quote(actor)}::uuid,${quote(id)}::uuid)`).join(",");
      const snapshots = [...fixtures.values()].map((row) => `(${quote(row.id)}::uuid,${quote(JSON.stringify(row))}::jsonb)`).join(",");
      const query = `BEGIN; SELECT id FROM public.clients WHERE id=ANY(${idArray}) FOR UPDATE;
        DO $cleanup$ BEGIN
          IF (SELECT count(*) FROM public.clients WHERE id=ANY(${idArray}))<>${ids.length}
            OR EXISTS(SELECT 1 FROM public.clients c JOIN (VALUES ${snapshots}) AS expected(id,body) ON expected.id=c.id
              WHERE to_jsonb(c) IS DISTINCT FROM expected.body OR left(c.name,${prefix.length})<>${quote(prefix)})
          THEN RAISE EXCEPTION 'fixture snapshot changed; no cleanup'; END IF;
          IF EXISTS(SELECT 1 FROM crm_private.client_requests WHERE
              ((response->>'id')::uuid=ANY(${idArray}) OR (envelope->>'client_id')::uuid=ANY(${idArray}))
              AND (actor_id,request_id) NOT IN (${pairs}))
          THEN RAISE EXCEPTION 'unknown fixture request; no cleanup'; END IF;
        END $cleanup$;
        DELETE FROM public.client_contact_corrections WHERE client_id=ANY(${idArray});
        DELETE FROM public.client_transitions WHERE client_id=ANY(${idArray});
        DELETE FROM public.client_milestones WHERE client_id=ANY(${idArray});
        DELETE FROM crm_private.client_requests WHERE (actor_id,request_id) IN (${pairs})
          AND ((response->>'id')::uuid=ANY(${idArray}) OR (envelope->>'client_id')::uuid=ANY(${idArray}));
        DELETE FROM public.clients WHERE id=ANY(${idArray}); COMMIT;`;
      // Read uncertain outcomes; never blindly retry an administrative DELETE.
      let uncertain = false;
      let writeFailure = "";
      try { await api("/database/query", { query, read_only: false }); }
      catch (error) {
        uncertain = true;
        writeFailure = error instanceof Error && /^Management HTTP \d{3}$/.test(error.message)
          ? error.message : "network/outcome unknown";
      }
      const result = await read(`SELECT (SELECT count(*) FROM public.clients WHERE id=ANY(${idArray})) AS clients,
        (SELECT count(*) FROM crm_private.client_requests WHERE (actor_id,request_id) IN (${pairs})) AS ledger`);
      const gone = Number(result[0].clients) === 0 && Number(result[0].ledger) === 0;
      if (uncertain && !gone) throw new Error(`Cleanup POST ${writeFailure}; fixture cleanup unconfirmed; no retry`);
      expect(gone).toBe(true);
    };
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Tokyo" });
    let stage = "authentication", primaryFailure: unknown;
    try {
      for (const [index, account] of accounts.entries()) {
        const login = await users[index].auth.signInWithPassword(account);
        expect(login.error === null && Boolean(login.data.user)).toBe(true);
        actorIds.push(login.data.user!.id);
        expect(actorIds[index] === baseline[0].members[index].user_id && baseline[0].members[index].slot === index + 1).toBe(true);
        const member = await users[index].rpc("current_user_is_crm_member");
        expect(member.error === null && member.data === true).toBe(true);
      }
      const page = await context.newPage();
      await page.goto("/login");
      await page.evaluate(({ email, password }) => {
        (document.querySelector('input[name="email"]') as HTMLInputElement).value = email;
        (document.querySelector('input[name="password"]') as HTMLInputElement).value = password;
      }, accounts[0]);
      await page.getByRole("button", { name: "Ingresar" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      stage = "owner UI creation";
      await page.goto("/clientes/nuevo");
      await page.getByLabel("Nombre *").fill(`${prefix}-owner`);
      request(0, await page.locator('[name="request_id"]').inputValue());
      await page.getByRole("button", { name: "Crear cliente" }).click();
      await expect(page).toHaveURL(/\/clientes\/[a-f0-9-]+\/editar\?/);
      const id = /\/clientes\/([a-f0-9-]+)\/editar/.exec(new URL(page.url()).pathname)![1];
      const first = await current(id);
      expect(first.version === 1 && first.status === "Contactado").toBe(true);
      stage = "owner UI edit";
      await page.getByLabel("Rubro").fill("Fixture de integración");
      await page.getByLabel("Estado").selectOption("Reunión agendada");
      await page.getByLabel("Fecha de contacto *").fill("2026-10-07T12:30");
      await page.getByLabel("Fecha de reunión").fill("2026-10-15T10:00");
      request(0, await page.locator('[name="request_id"]').inputValue(), id);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('[name="version"]')).toHaveValue("2");
      const edited = await current(id);
      expect(edited.status === "Reunión agendada" && new Date(edited.contact_at).toISOString() === "2026-10-07T15:30:00.000Z" &&
        new Date(edited.meeting_at!).toISOString() === "2026-10-15T13:00:00.000Z").toBe(true);
      await page.reload(); await expect(page.getByLabel("Rubro")).toHaveValue("Fixture de integración");
      stage = "partner RPC update";
      const moved = await users[1].rpc("update_client", { p_request_id: request(1, randomUUID(), id), p_client_id: id,
        p_expected_version: 2, p_payload: { name: `${prefix}-partner-update`, status: "Cerrado" } });
      expect(moved.error === null).toBe(true); remember(moved.data);
      stage = "owner RPC stale-version HTTP contract";
      const staleRpcRequest = request(0, randomUUID(), id);
      const staleRpc = await users[0].rpc("update_client", { p_request_id: staleRpcRequest, p_client_id: id,
        p_expected_version: 2, p_payload: { notes: "Edición obsoleta" } });
      expect(staleRpc.status).toBe(409);
      expect(staleRpc.error?.code).toBe("PT409");
      expect(staleRpc.error?.message).toBe("client_version_conflict");
      expect(staleRpc.data).toBeNull();
      requests.find((row) => row.actor === actorIds[0] && row.id === staleRpcRequest)!.rolledBack = true;
      console.log("Observed live stale RPC: HTTP409/PT409/client_version_conflict, null data; rollback confirmed.");
      stage = "owner stale-version conflict";
      await page.getByLabel("Notas").fill("Edición obsoleta");
      const staleRequest = request(0, await page.locator('[name="request_id"]').inputValue(), id);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('section [role="alert"]')).toHaveText("Este cliente se actualizó mientras lo editabas.");
      await expect(page.getByText("Versión confirmada: 3")).toBeVisible();
      expect((await current(id)).notes === null).toBe(true);
      requests.find((row) => row.actor === actorIds[0] && row.id === staleRequest)!.rolledBack = true;
      stage = "owner conscious edit";
      await page.getByRole("button", { name: "Volver a editar" }).click();
      await page.getByLabel("Notas").fill("Edición consciente confirmada");
      request(0, await page.locator('[name="request_id"]').inputValue(), id);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('[name="version"]')).toHaveValue("4");
      expect((await current(id)).notes === "Edición consciente confirmada").toBe(true);
      stage = "partner creation and replay";
      const secondId = request(1), literalName = ".*+?^${}()|[]\\%_", payload = { name: `${prefix}-partner${literalName}` };
      const second = await users[1].rpc("create_client", { p_request_id: secondId, p_payload: payload });
      expect(second.error === null).toBe(true); remember(second.data);
      const replay = await users[1].rpc("create_client", { p_request_id: secondId, p_payload: payload });
      expect(replay.error === null && replay.data?.id === second.data?.id && replay.data?.version === 1).toBe(true);
      expect(fixtures.size).toBe(2);
      if (kanbanRun) {
        stage = "TASK-006 Kanban procedure";
        await runKanbanLiveFlow({ page, prefix, users, actorIds, requests, request, remember, current, read, fixtures });
      } else {
      stage = "shared table and combined filter reads";
      await page.goto("/clientes?vista=tabla");
      const table = page.getByRole("table", { name: "Clientes" });
      await expect(page.getByRole("button", { name: "Filtros de clientes" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(table.locator("tbody tr")).toHaveCount(2);
      await expect(table.getByText(`${prefix}-partner-update`, { exact: true })).toBeVisible();
      await expect(table.getByText(payload.name, { exact: true })).toBeVisible();
      // Case-insensitive partial matching and literal regex/PostgREST metacharacters.
      await page.goto(`/clientes?nombre=${encodeURIComponent(literalName.toUpperCase())}&vista=tabla`);
      await expect(table.locator("tbody tr")).toHaveCount(1);
      await expect(table.getByText(payload.name, { exact: true })).toBeVisible();
      const combined = new URLSearchParams({ nombre: prefix.toUpperCase(), desde: "2026-10-07", hasta: "2026-10-07", vista: "tabla" });
      combined.append("estado", "Reunión agendada"); combined.append("estado", "Cerrado");
      const returnPath = `/clientes?${combined}`;
      const assertReturnFilters = () => expect([...new URL(page.url()).searchParams].sort()).toEqual([...combined].sort());
      stage = "out-of-range pagination contract and keyboard recovery";
      const outside = await users[0].from("clients").select("id", { count: "exact" }).range(50, 99);
      expect(outside.status).toBe(416);
      expect(outside.error?.code).toBe("PGRST103");
      expect(outside.data).toBeNull();
      expect(outside.count).toBeNull();
      await page.goto(`${returnPath}&pagina=2`);
      await expect(page.getByText("Esta página ya no tiene resultados.")).toBeVisible();
      const recoverPage = page.getByRole("link", { name: "Volver a la primera página" });
      await recoverPage.focus();
      await page.keyboard.press("Enter");
      await expect(page).not.toHaveURL(/pagina=2/);
      assertReturnFilters();
      await expect(table.locator("tbody tr")).toHaveCount(1);
      console.log("Observed live pagination: HTTP416/PGRST103, null data/count; keyboard recovery preserved filters.");
      stage = "shared table and combined filter reads";
      await page.goto(returnPath);
      await expect(table.locator("tbody tr")).toHaveCount(1);
      await expect(table.getByText("07/10/2026 12:30", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: `Editar ${prefix}-partner-update`, exact: true }).click();
      await page.getByRole("link", { name: "Cancelar", exact: true }).click();
      assertReturnFilters();
      await page.getByRole("link", { name: "Nuevo cliente", exact: true }).click();
      await page.getByRole("link", { name: "Cancelar", exact: true }).click();
      assertReturnFilters();
      stage = "inline filter keyboard and mobile reads";
      await page.getByRole("button", { name: "Filtros de clientes" }).click();
      const panel = page.getByRole("region", { name: "Filtrar clientes" });
      await expect(panel.getByLabel("Nombre", { exact: true })).toBeFocused();
      await expect(table).toHaveCount(0);
      await panel.getByLabel("Nombre", { exact: true }).fill("discarded draft");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Filtros de clientes" })).toBeFocused();
      assertReturnFilters();
      await page.setViewportSize({ width: 390, height: 960 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(table.getByText(`Contacto: 07/10/2026 12:30`)).toBeVisible();
      const mobileRow = table.locator("tbody tr").first();
      const stateBox = await mobileRow.getByText("Cerrado", { exact: true }).boundingBox();
      const editBox = await mobileRow.getByRole("link", { name: /^Editar/ }).boundingBox();
      expect(stateBox !== null && editBox !== null).toBe(true);
      expect(editBox!.x).toBe(stateBox!.x);
      expect(editBox!.y).toBeGreaterThanOrEqual(stateBox!.y + stateBox!.height);
      await page.getByRole("button", { name: "Filtros de clientes" }).click();
      expect((await panel.boundingBox())?.width).toBeCloseTo(358, 0);
      await panel.getByLabel("Nombre", { exact: true }).fill(prefix);
      await panel.getByLabel("Desde", { exact: true }).fill("2026-10-08");
      await panel.getByRole("button", { name: "Aplicar filtros" }).click();
      await expect(page.locator('section [role="alert"]')).toContainText("rango de fechas");
      await page.goto(`/clientes?nombre=${encodeURIComponent(prefix)}&estado=Sin+respuesta&vista=tabla`);
      await expect(page.getByText("No hay clientes que coincidan con los filtros.")).toBeVisible();
      await page.getByRole("button", { name: "Filtros de clientes" }).click();
      await panel.getByRole("link", { name: "Limpiar filtros" }).click();
      await expect(page).toHaveURL(/\/clientes\?vista=tabla$/);
      await expect(table.locator("tbody tr")).toHaveCount(2);
      }
    } catch (error) {
      primaryFailure = new Error(`Live fixture stage: ${stage}`, { cause: error });
    } finally {
      await finishLiveRun(() => context.close(), cleanup, users.map((user) => async () => {
        const result = await user.auth.signOut({ scope: "local" });
        if (result.error) throw new Error("Fixture sign-out unconfirmed");
      }), primaryFailure);
    }
  });
}
