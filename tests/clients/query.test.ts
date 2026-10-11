import { beforeEach, describe, expect, it, vi } from "vitest";
import { listClients } from "@/lib/clients/server";
import { confirmed } from "./fixture";
import { createClient } from "@supabase/supabase-js";

const f = vi.hoisted(() => ({ guard: vi.fn(), from: vi.fn(), select: vi.fn(), ilike: vi.fn(), regexIMatch: vi.fn(), or: vi.fn(), in: vi.fn(),
  gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn(), is: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-member", () => ({ requireMember: f.guard }));

describe("guarded paginated client queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.guard.mockResolvedValue({ client: { from: f.from } });
    for (const key of ["from", "select", "ilike", "regexIMatch", "or", "in", "gte", "lt", "order", "is"] as const) f[key].mockReturnValue(f);
    f.range.mockResolvedValue({ data: [confirmed], count: 51, error: null });
  });
  it.each(["nombre", "contacto", "reunion"])("sorts %s server-side with stable id tie breaking and nullable meetings last", async (sort) => {
    f.range.mockResolvedValue({ data: [confirmed], count: 1, error: null });
    expect((await listClients({ orden: sort, direccion: "asc" })).kind).toBe("found");
    const column = { nombre: "name", contacto: "contact_at", reunion: "meeting_at" }[sort]!;
    expect(f.order.mock.calls).toEqual([[column, { ascending: true, nullsFirst: false }], ["id", { ascending: true }]]);
  });
  it("quotes every search literal in an OR across name/company without interpreting filter or regex syntax", async () => {
    f.range.mockResolvedValue({ data: [confirmed], count: 1, error: null });
    await listClients({ nombre: 'A",company.not.is.null,(x)\\%_*' });
    expect(f.or).toHaveBeenCalledOnce();
    const expression = f.or.mock.calls[0][0] as string;
    expect(expression.startsWith('name.imatch."')).toBe(true);
    expect(expression).toContain(',company.imatch."');
    expect(expression).toContain('\\"'); expect(expression).toContain('\\\\('); expect(expression).toContain('\\\\\\\\');
    expect(f.regexIMatch).not.toHaveBeenCalled(); expect(f.ilike).not.toHaveBeenCalled();
  });
  it("serializes a literal company search and stable nullable order through the actual Supabase client", async () => {
    const requests: URL[] = [];
    const client = createClient("https://local.invalid", "local-fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input) => {
        requests.push(new URL(String(input)));
        return new Response(JSON.stringify([{ ...confirmed, company: null }]), {
          headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
        });
      } },
    });
    f.guard.mockResolvedValue({ client });
    const search = 'Empresa",(x)\\%_*';
    const result = await listClients({ nombre: search, orden: "reunion", direccion: "asc" });
    expect(result).toMatchObject({ kind: "found", rows: [{ company: null }] });
    expect(requests).toHaveLength(1);
    const literal = JSON.stringify('Empresa",\\(x\\)\\\\%_\\*');
    expect(requests[0].searchParams.get("or")).toBe(`(name.imatch.${literal},company.imatch.${literal})`);
    expect(requests[0].searchParams.get("order")).toBe("meeting_at.asc.nullslast,id.asc");
    expect(requests[0].searchParams.get("offset")).toBe("0");
    expect(requests[0].searchParams.get("limit")).toBe("50");
  });
  it("guards first and combines literal partial case-insensitive name, states and inclusive BA dates", async () => {
    const result = await listClients({ nombre: "A%_\\", estado: ["Contactado", "Cerrado"],
      desde: "2026-10-07", hasta: "2026-10-07", pagina: "2" });
    expect(result.kind).toBe("found");
    expect(f.guard).toHaveBeenCalledOnce();
    expect(f.is).toHaveBeenCalledWith("deleted_at", null);
    const quoted = JSON.stringify("A%_\\\\");
    expect(f.or).toHaveBeenCalledWith(`name.imatch.${quoted},company.imatch.${quoted}`);
    expect(f.in).toHaveBeenCalledWith("status", ["Contactado", "Cerrado"]);
    expect(f.gte).toHaveBeenCalledWith("contact_at", "2026-10-07T03:00:00.000Z");
    expect(f.lt).toHaveBeenCalledWith("contact_at", "2026-10-08T03:00:00.000Z");
    expect(f.range).toHaveBeenCalledWith(50, 99);
    expect(f.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(f.order.mock.calls).toEqual([["contact_at", { ascending: false, nullsFirst: false }], ["id", { ascending: true }]]);
  });
  it("treats PostgREST wildcard aliases and regex syntax as literal partial name text", async () => {
    f.range.mockResolvedValue({ data: [confirmed], count: 1, error: null });
    await listClients({ nombre: ".*+?^${}()|[]\\%_" });
    const quoted = JSON.stringify("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\%_");
    expect(f.or).toHaveBeenCalledWith(`name.imatch.${quoted},company.imatch.${quoted}`);
    expect(f.ilike).not.toHaveBeenCalled();
  });
  it("never queries invalid filters or an unauthenticated caller", async () => {
    expect((await listClients({ estado: "unknown" })).kind).toBe("invalid");
    expect(f.from).not.toHaveBeenCalled();
    f.guard.mockRejectedValue(new Error("blocked"));
    await expect(listClients({})).rejects.toThrow("blocked");
    expect(f.from).not.toHaveBeenCalled();
  });
  it("classifies only the real 416/PGRST103 shape on a later page without inventing rows or count", async () => {
    f.range.mockResolvedValue({ status: 416, data: null, count: null,
      error: { code: "PGRST103", message: "Requested range not satisfiable", details: "An offset of 50 was requested, but there are only 2 rows.", hint: null } });
    const result = await listClients({ nombre: "Confirmado", estado: "Contactado", pagina: "2" });
    expect(result).toMatchObject({ kind: "out_of_range", filters: { name: "Confirmado", statuses: ["Contactado"], page: 2 } });
    expect(result).not.toHaveProperty("rows");
    expect(result).not.toHaveProperty("count");
  });
  it.each([
    { status: 416, code: "PGRST103", page: "1" },
    { status: 500, code: "PGRST103", page: "2" },
    { status: 416, code: "other", page: "2" },
    { status: 416, code: undefined, page: "2" },
  ])("keeps other status/code/page combinations unavailable: %j", async ({ status, code, page }) => {
    f.range.mockResolvedValue({ status, data: null, count: null, error: { code, message: "private details" } });
    expect((await listClients({ pagina: page })).kind).toBe("unavailable");
  });
  it.each([
    { data: null, count: null, error: { message: "private details" } },
    { data: [{ id: confirmed.id }], count: 1, error: null },
    { data: [confirmed], count: null, error: null },
    { data: [confirmed], count: 0, error: null },
    { data: [confirmed], count: 100, error: null },
  ])("fails closed on errors, invalid rows, missing counts or silent response truncation", async (response) => {
    f.range.mockResolvedValue(response);
    expect((await listClients({})).kind).toBe("unavailable");
  });
  it("handles an empty database and transport failures without exposing internals", async () => {
    f.range.mockResolvedValueOnce({ data: [], count: 0, error: null });
    expect(await listClients({})).toMatchObject({ kind: "found", rows: [], count: 0 });
    f.range.mockRejectedValueOnce(new Error("transport"));
    expect((await listClients({})).kind).toBe("unavailable");
  });
});
