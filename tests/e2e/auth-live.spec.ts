import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type Account = { email: string; password: string };
type LiveConfig = { url: string; key: string; ref: string; accounts: Account[] };
let config: LiveConfig;
const unbound = process.env.CRM_LIVE_EXPECT_UNBOUND === "1";
const naturalExpiry = process.env.CRM_LIVE_NATURAL_EXPIRY === "1";
let managementToken: string | undefined;

test.beforeAll(async () => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "CRM_OWNER_EMAIL", "CRM_PARTNER_EMAIL", "CRM_OWNER_PASSWORD", "CRM_PARTNER_PASSWORD", "CRM_LIVE_PROJECT_REF"];
  if (naturalExpiry) names.push("SUPABASE_ACCESS_TOKEN");
  const selected: string[] = [];
  // Whitelist before parsing values: admin/DB/GitHub credentials are never selected.
  for await (const line of createInterface({ input: createReadStream(".env"), crlfDelay: Infinity })) {
    const name = /^\s*(?:export\s+)?([A-Z_]+)\s*=/.exec(line)?.[1];
    if (name && names.includes(name)) selected.push(line);
  }
  const values = parseEnv(selected.join("\n"));
  for (const name of names) if (process.env[name] !== undefined) values[name] = process.env[name]!;
  for (const name of names) expect(Boolean(values[name]), `Falta ${name}; no se simula Auth`).toBe(true);
  const required = (name: string) => values[name]!;
  managementToken = naturalExpiry ? required("SUPABASE_ACCESS_TOKEN") : undefined;
  const url = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
  const ref = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname)?.[1];
  expect(url.protocol === "https:" && ref === values.CRM_LIVE_PROJECT_REF, "Proyecto de prueba debe ser explícito").toBe(true);
  expect(required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY").startsWith("sb_publishable_"), "Sólo clave pública").toBe(true);
  config = { url: url.origin, ref: ref!, key: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), accounts: [
    { email: required("CRM_OWNER_EMAIL"), password: required("CRM_OWNER_PASSWORD") },
    { email: required("CRM_PARTNER_EMAIL"), password: required("CRM_PARTNER_PASSWORD") },
  ] };
});

test.afterEach(async ({ context }) => {
  // Close sensitive DOM before runner diagnostics; no cookies/session files are exported.
  await context.close();
});

function userClient() {
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
  });
}

// Explicit administrative verification mode; ordinary live runs never load a PAT
// or modify provider configuration. No token/cookie/password is persisted.
if (naturalExpiry) {
  test("natural JWT expiration renews valid refresh and rejects revoked refresh", async ({ context, browser }) => {
    test.setTimeout(420_000);
    const api = async (path: string, method = "GET", body?: object) => {
      const response = await fetch(`https://api.supabase.com/v1/projects/${config.ref}${path}`, {
        method, headers: { Authorization: `Bearer ${managementToken}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Management HTTP ${response.status}`);
      return response.json();
    };
    const project = await api("");
    expect(project.id === config.ref && project.status === "ACTIVE_HEALTHY").toBe(true);
    const baseline = await api("/config/auth");
    expect(baseline.jwt_exp === 3600 && baseline.disable_signup === true).toBe(true);
    const rows = await api("/database/query/read-only", "POST", { query:
      "SELECT (SELECT count(*) FROM auth.users) AS users,(SELECT count(*) FROM public.clients) AS clients," +
      "(SELECT jsonb_agg(jsonb_build_object('slot',slot,'user_id',user_id) ORDER BY slot) FROM public.crm_members) AS members" });
    expect(Number(rows[0].users) === 2 && Number(rows[0].clients) === 0 && rows[0].members.length === 2).toBe(true);
    for (const [index, account] of config.accounts.entries()) {
      const caller = userClient();
      const login = await caller.auth.signInWithPassword(account);
      expect(login.error === null && login.data.user?.id === rows[0].members[index].user_id &&
        rows[0].members[index].slot === index + 1, "Binding acordado antes del PATCH").toBe(true);
      await caller.auth.signOut({ scope: "local" });
    }
    const sessions: Awaited<ReturnType<typeof serverCookies>>[] = [];
    const claims: { iat: number; exp: number }[] = [];
    try {
      await api("/config/auth", "PATCH", { jwt_exp: 300 });
      expect((await api("/config/auth")).jwt_exp === 300).toBe(true);
      for (const [index, account] of config.accounts.entries()) {
        // Configuration propagation is proven by the newly issued signed JWT.
        for (let attempt = 0; attempt < 10; attempt++) {
          const auth = await serverCookies(account);
          const claim = JSON.parse(Buffer.from(auth.session.access_token.split(".")[1], "base64url").toString("utf8"));
          if (claim.exp - claim.iat === 300) { sessions.push(auth); claims.push(claim); break; }
          await auth.client.auth.signOut({ scope: "local" });
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
        expect(sessions.length === index + 1, "Provider debe emitir TTL natural de 300s").toBe(true);
        const auth = sessions[index];
        const identity = await auth.client.auth.getUser(auth.session.access_token);
        expect(identity.error === null && identity.data.user?.id === rows[0].members[index].user_id &&
          rows[0].members[index].slot === index + 1).toBe(true);
      }
    } finally {
      // Read before each restoration attempt; never leave short TTL during wait.
      let restored = false;
      for (let attempt = 0; attempt < 3 && !restored; attempt++) {
        try {
          const current = await api("/config/auth");
          if (current.jwt_exp !== 3600) await api("/config/auth", "PATCH", { jwt_exp: 3600 });
          restored = (await api("/config/auth")).jwt_exp === 3600;
        } catch { console.log(`TTL restoration readback attempt ${attempt + 1} unavailable`); }
      }
      expect(restored, "TTL original debe quedar restaurado antes de esperar").toBe(true);
      const after = await api("/config/auth");
      expect(Object.keys(baseline).every((key) => JSON.stringify(baseline[key]) === JSON.stringify(after[key])),
        "Ninguna otra configuración cambia").toBe(true);
      console.log("Natural expiry: jwt_exp restored=3600; issued", claims.map(({ iat, exp }) => ({ iat, exp })));
    }
    expect((await sessions[1].client.auth.signOut({ scope: "local" })).error === null).toBe(true);
    const target = Math.max(...claims.map(({ exp }) => exp)) * 1000 + 5_000;
    while (Date.now() < target) {
      const remaining = target - Date.now();
      console.log(`Natural expiry: waiting ${Math.ceil(remaining / 1000)}s; provider TTL already restored`);
      await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, remaining)));
    }
    for (const auth of sessions) {
      const response = await fetch(`${config.url}/auth/v1/user`, { headers: {
        apikey: config.key, Authorization: `Bearer ${auth.session.access_token}` }, signal: AbortSignal.timeout(15_000) });
      expect(response.status === 401 || response.status === 403, "JWT natural vencido debe ser rechazado").toBe(true);
    }
    await installCookies(context, sessions[0].cookies);
    const renewed = await context.request.get("/dashboard", { maxRedirects: 0 });
    expect(renewed.status() === 200 && renewed.headers()["cache-control"].includes("no-store")).toBe(true);
    const cookieChanged = (await context.cookies()).some((cookie) => cookie.name.startsWith(`sb-${config.ref}-auth-token`) &&
      !sessions[0].cookies.some((old) => old.name === cookie.name && old.value === cookie.value));
    expect(cookieChanged, "Refresh válido cambia cookie después de exp natural").toBe(true);
    expect((await context.request.get("/dashboard")).status()).toBe(200);
    const revoked = await browser.newContext();
    try {
      await installCookies(revoked, sessions[1].cookies);
      const denied = await revoked.request.get("/dashboard", { maxRedirects: 0 });
      expect(denied.status() === 307 && denied.headers()["location"].includes("reason=expired")).toBe(true);
    } finally { await revoked.close(); await sessions[0].client.auth.signOut({ scope: "local" }); }
  });
}

async function fillCredentials(page: Page, account: Account) {
  await expect(page.getByLabel("Email")).toBeVisible();
  // Avoid fill(password) call logs: secrets travel only as in-memory evaluate arguments.
  await page.evaluate(({ email, password }) => {
    (document.querySelector('input[name="email"]') as HTMLInputElement).value = email;
    (document.querySelector('input[name="password"]') as HTMLInputElement).value = password;
  }, account);
}

async function browserLogin(page: Page, account: Account) {
  await page.goto("/login");
  await fillCredentials(page, account);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

async function serverCookies(account: Account) {
  const writes = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const client = createServerClient(config.url, config.key, { cookies: {
    getAll: () => [],
    setAll: (values) => { values.forEach((cookie) => writes.set(cookie.name, cookie)); },
  } });
  const result = await client.auth.signInWithPassword(account);
  expect(result.error === null && Boolean(result.data.session), "Auth real debe emitir sesión").toBe(true);
  return { client, session: result.data.session!, cookies: [...writes.values()] };
}

async function installCookies(context: BrowserContext, cookies: { name: string; value: string }[]) {
  await context.addCookies(cookies.map(({ name, value }) => ({ name, value, url: "http://127.0.0.1:3000" })));
}

if (unbound) {
  test("real authenticated account is denied before member binding", async ({ page, context }) => {
    const account = config.accounts[0];
    const client = userClient();
    expect((await client.auth.signInWithPassword(account)).error === null).toBe(true);
    const member = await client.rpc("current_user_is_crm_member");
    expect(member.error === null && member.data === false, "Identidad real todavía no es miembro").toBe(true);
    const rows = await client.from("clients").select("id", { count: "exact", head: true });
    expect(rows.error === null && rows.count === 0, "RLS oculta cartera a no miembro").toBe(true);
    const operation = await client.rpc("create_client", { p_request_id: randomUUID(), p_payload: {} });
    expect(operation.error?.code === "42501", "Operación directa rechaza no miembro").toBe(true);
    const session = await serverCookies(account);
    await installCookies(context, session.cookies);
    const response = await context.request.get("/dashboard", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/login?reason=denied");
    await context.clearCookies();
    await browserLogin(page, account);
    await expect(page).toHaveURL(/\/login\?reason=denied$/);
    await expect(page.locator(".auth-error[role=alert]")).toHaveText("Esta cuenta no tiene acceso al CRM.");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await client.auth.signOut({ scope: "local" })).error === null).toBe(true);
    await session.client.auth.signOut({ scope: "local" });
  });
} else {
  for (const index of [0, 1]) {
    test(`member ${index + 1} signs in, validates direct access and logs out`, async ({ page, context }) => {
      const account = config.accounts[index];
      const client = userClient();
      const login = await client.auth.signInWithPassword(account);
      expect(login.error === null && Boolean(login.data.user), "Ingreso real del miembro").toBe(true);
      const identity = await client.auth.getUser();
      expect(identity.error === null && identity.data.user?.id === login.data.user?.id).toBe(true);
      const membership = await client.rpc("current_user_is_crm_member");
      expect(membership.error === null && membership.data === true).toBe(true);
      const read = await client.from("clients").select("id", { count: "exact", head: true });
      expect(read.error === null).toBe(true);
      const invalid = await client.rpc("create_client", { p_request_id: randomUUID(), p_payload: {} });
      expect(invalid.error?.code === "23502", "Nombre ausente viola NOT NULL").toBe(true);
      const unchanged = await client.from("clients").select("id", { count: "exact", head: true });
      expect(unchanged.error === null && unchanged.count === read.count, "RPC inválido no creó filas").toBe(true);
      await browserLogin(page, account);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      const response = await context.request.get("/dashboard");
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("no-store");
      await page.getByRole("button", { name: "Cerrar sesión" }).click();
      await expect(page).toHaveURL(/\/login$/);
      const rejected = await context.request.get("/dashboard", { maxRedirects: 0 });
      expect(rejected.status()).toBe(307);
      expect(rejected.headers()["location"]).toContain("reason=expired");
      expect((await client.auth.signOut({ scope: "local" })).error === null).toBe(true);
    });
  }

  test("provider rejects wrong password and anonymous direct operations", async ({ page }) => {
    const wrong = { ...config.accounts[0], password: randomUUID() + randomUUID() };
    await browserLogin(page, wrong);
    await expect(page.locator("#login-error")).toHaveText("Email o contraseña incorrectos. Revisá los datos e intentá de nuevo.");
    await expect(page).toHaveURL(/\/login$/);
    const anonymous = userClient();
    const membership = await anonymous.rpc("current_user_is_crm_member");
    expect(Boolean(membership.error), "Anónimo no ejecuta puente").toBe(true);
    const operation = await anonymous.rpc("create_client", { p_request_id: randomUUID(), p_payload: {} });
    expect(Boolean(operation.error), "Anónimo no ejecuta escritura").toBe(true);
  });

  test("real provider renewal updates SSR cookies and subsequent requests", async ({ context }) => {
    const auth = await serverCookies(config.accounts[0]);
    // Expire SDK metadata only; the signed JWT is unmodified and not yet expired.
    // This proves real refresh/cookie plumbing, not cryptographic JWT expiration.
    const expiredMetadata = { ...auth.session, expires_at: 1 };
    const prefix = `sb-${config.ref}-auth-token`;
    const encoded = "base64-" + Buffer.from(JSON.stringify(expiredMetadata)).toString("base64url");
    const cookies = [];
    for (let offset = 0; offset < encoded.length; offset += 3180) {
      cookies.push({ name: `${prefix}.${cookies.length}`, value: encoded.slice(offset, offset + 3180) });
    }
    await installCookies(context, cookies);
    const response = await context.request.get("/dashboard", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["pragma"]).toBe("no-cache");
    const after = (await context.cookies()).filter((cookie) => cookie.name === prefix || cookie.name.startsWith(`${prefix}.`));
    const joined = after.sort((a, b) => a.name.localeCompare(b.name)).map((cookie) => cookie.value).join("");
    expect(joined.startsWith("base64-"), "Cookie SSR debe conservar formato esperado").toBe(true);
    const renewed = JSON.parse(Buffer.from(joined.slice(7), "base64url").toString("utf8"));
    expect(renewed.expires_at > Date.now() / 1000, "Provider extendió expiración de metadata").toBe(true);
    expect(renewed.refresh_token !== auth.session.refresh_token, "Refresh real rotó token").toBe(true);
    const next = await context.request.get("/dashboard");
    expect(next.status()).toBe(200);
    expect((await auth.client.auth.getUser(renewed.access_token)).error === null, "Nuevo token validado por Auth").toBe(true);
    await auth.client.auth.signOut({ scope: "local" });
  });
}
