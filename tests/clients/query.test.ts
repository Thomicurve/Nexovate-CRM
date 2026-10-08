import { beforeEach, describe, expect, it, vi } from "vitest";
import { listClients } from "@/lib/clients/server";
import { confirmed } from "./fixture";

const f = vi.hoisted(() => ({ guard: vi.fn(), from: vi.fn(), select: vi.fn(), ilike: vi.fn(), regexIMatch: vi.fn(), in: vi.fn(),
  gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-member", () => ({ requireMember: f.guard }));

describe("guarded paginated client queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.guard.mockResolvedValue({ client: { from: f.from } });
    for (const key of ["from", "select", "ilike", "regexIMatch", "in", "gte", "lt", "order"] as const) f[key].mockReturnValue(f);
    f.range.mockResolvedValue({ data: [confirmed], count: 51, error: null });
  });
  it("guards first and combines literal partial case-insensitive name, states and inclusive BA dates", async () => {
    const result = await listClients({ nombre: "A%_\\", estado: ["Contactado", "Cerrado"],
      desde: "2026-10-07", hasta: "2026-10-07", pagina: "2" });
    expect(result.kind).toBe("found");
    expect(f.guard).toHaveBeenCalledOnce();
    expect(f.regexIMatch).toHaveBeenCalledWith("name", "A%_\\\\");
    expect(f.in).toHaveBeenCalledWith("status", ["Contactado", "Cerrado"]);
    expect(f.gte).toHaveBeenCalledWith("contact_at", "2026-10-07T03:00:00.000Z");
    expect(f.lt).toHaveBeenCalledWith("contact_at", "2026-10-08T03:00:00.000Z");
    expect(f.range).toHaveBeenCalledWith(50, 99);
    expect(f.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(f.order.mock.calls).toEqual([["contact_at", { ascending: false }], ["id", { ascending: true }]]);
  });
  it("treats PostgREST wildcard aliases and regex syntax as literal partial name text", async () => {
    f.range.mockResolvedValue({ data: [confirmed], count: 1, error: null });
    await listClients({ nombre: ".*+?^${}()|[]\\%_" });
    expect(f.regexIMatch).toHaveBeenCalledWith("name", "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\%_");
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
