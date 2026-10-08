import { describe, expect, it } from "vitest";
import { listPath, parseFilters } from "@/lib/clients/filters";
import { safeReturnPath } from "@/lib/clients/model";

describe("client filter URL contract", () => {
  it("canonicalizes name, repeated statuses and page without losing combined filters", () => {
    const parsed = parseFilters({ nombre: "  Ana  ", estado: ["Cerrado", "Contactado", "Cerrado"],
      desde: "2026-10-07", hasta: "2026-10-07", pagina: "2" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("expected valid filters");
    expect(parsed.filters).toMatchObject({ name: "Ana", statuses: ["Contactado", "Cerrado"], page: 2,
      fromUtc: "2026-10-07T03:00:00.000Z", untilUtc: "2026-10-08T03:00:00.000Z" });
    expect(listPath(parsed.filters, 1)).toBe("/clientes?nombre=Ana&estado=Contactado&estado=Cerrado&desde=2026-10-07&hasta=2026-10-07");
  });
  it.each([
    { desde: "2026-02-30" }, { hasta: "2026-13-01" }, { desde: "2026-10-08", hasta: "2026-10-07" },
    { estado: ["Cerrado", "unknown"] }, { nombre: ["Ana", "Bob"] }, { desde: ["2026-10-07", "2026-10-08"] },
    { pagina: "0" }, { pagina: "2.5" }, { pagina: "9007199254740992" }, { nombre: "x".repeat(201) },
    { unexpected: "value" },
  ])("rejects malformed filters instead of silently reading everything: %j", (value) => {
    expect(parseFilters(value).ok).toBe(false);
  });
  it("uses Buenos Aires month/year boundaries and an empty URL without active filters", () => {
    const parsed = parseFilters({ desde: "2024-02-29", hasta: "2024-12-31" });
    if (!parsed.ok) throw new Error("expected valid filters");
    expect(parsed.filters.fromUtc).toBe("2024-02-29T03:00:00.000Z");
    expect(parsed.filters.untilUtc).toBe("2025-01-01T03:00:00.000Z");
    const empty = parseFilters({});
    if (empty.ok) expect(listPath(empty.filters)).toBe("/clientes");
  });
  it("includes a valid day whose midnight was skipped by Buenos Aires DST", () => {
    const parsed = parseFilters({ desde: "2007-12-30", hasta: "2007-12-30" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("valid calendar day");
    expect(parsed.filters.fromUtc).toBe("2007-12-30T03:00:00.000Z");
    expect(parsed.filters.untilUtc).toBe("2007-12-31T02:00:00.000Z");
  });
  it("validates return dates and page while preserving the applied combination", () => {
    expect(safeReturnPath("/clientes?nombre=Ana&estado=Cerrado&desde=2026-10-07&pagina=2")).toBe("/clientes?nombre=Ana&estado=Cerrado&desde=2026-10-07&pagina=2");
    expect(safeReturnPath("/clientes?desde=2026-02-30")).toBe("/clientes");
    expect(safeReturnPath("/clientes?nombre=Ana&nombre=Bob")).toBe("/clientes");
  });
});
