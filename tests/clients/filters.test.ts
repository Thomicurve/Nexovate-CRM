import { describe, expect, it } from "vitest";
import { listPath, parseFilters } from "@/lib/clients/filters";
import { safeReturnPath } from "@/lib/clients/model";

describe("client filter URL contract", () => {
  it("keeps allowlisted sorting in pagination, view changes and safe edit returns", () => {
    const parsed = parseFilters({ nombre: "Empresa", orden: "reunion", direccion: "asc", vista: "tabla", pagina: "2" });
    expect(parsed.ok).toBe(true); if (!parsed.ok) throw new Error("valid sorting");
    expect(parsed.filters).toMatchObject({ sort: "reunion", direction: "asc" });
    const path = listPath(parsed.filters);
    expect(path).toContain("orden=reunion"); expect(path).toContain("direccion=asc");
    expect(safeReturnPath(path)).toBe(path);
    expect(listPath({ ...parsed.filters, view: "kanban" }, 3)).toContain("pagina=3");
    expect(parseFilters({ orden: "name.desc;drop" }).ok).toBe(false);
    expect(parseFilters({ direccion: ["asc", "desc"] }).ok).toBe(false);
    expect(safeReturnPath("/clientes?orden=evil&direccion=asc")).toBe("/clientes");
    expect(safeReturnPath("//evil.invalid/clientes?orden=nombre")).toBe("/clientes");
  });
  it("defaults to Kanban and preserves an explicitly validated view with filters, page and safe return", () => {
    const empty = parseFilters({}); if (!empty.ok) throw new Error("valid defaults");
    expect(empty.filters.view).toBe("kanban");
    const parsed = parseFilters({ vista: "tabla", nombre: "Ana", estado: "Cerrado", pagina: "2" });
    expect(parsed.ok).toBe(true); if (!parsed.ok) throw new Error("valid table filters");
    expect(listPath(parsed.filters)).toBe("/clientes?nombre=Ana&estado=Cerrado&pagina=2&vista=tabla");
    expect(safeReturnPath("/clientes?nombre=Ana&estado=Cerrado&pagina=2&vista=tabla")).toBe(listPath(parsed.filters));
    expect(parseFilters({ vista: "unknown" }).ok).toBe(false);
    expect(parseFilters({ vista: ["kanban", "tabla"] }).ok).toBe(false);
  });
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
