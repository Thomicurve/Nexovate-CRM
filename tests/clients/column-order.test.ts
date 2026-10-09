import { describe, expect, it, vi } from "vitest";
import { KANBAN_STATUSES, normalizeColumnOrder, readColumnOrder, saveColumnOrder, reorderColumn } from "@/lib/clients/column-order";

describe("browser-only column order", () => {
  it("filters unknown and duplicate values, completes six states and keeps domain order independent", () => {
    expect(normalizeColumnOrder(["Cerrado", "unknown", "Cerrado", "Contactado"])).toEqual(["Cerrado", "Contactado", ...KANBAN_STATUSES.filter((status) => !["Cerrado", "Contactado"].includes(status))]);
    for (const value of [null, {}, "Cerrado", 42]) expect(normalizeColumnOrder(value)).toEqual(KANBAN_STATUSES);
  });
  it("reads without overwriting stored preferences and tolerates corruption or denied access", () => {
    const storage = { getItem: vi.fn(() => '["Cerrado"]'), setItem: vi.fn() };
    expect(readColumnOrder(storage)[0]).toBe("Cerrado"); expect(storage.setItem).not.toHaveBeenCalled();
    storage.getItem.mockReturnValue("broken"); expect(readColumnOrder(storage)).toEqual(KANBAN_STATUSES);
    storage.getItem.mockImplementation(() => { throw new Error("denied"); }); expect(readColumnOrder(storage)).toEqual(KANBAN_STATUSES);
    storage.setItem.mockImplementation(() => { throw new Error("denied"); }); expect(() => saveColumnOrder(KANBAN_STATUSES, storage)).not.toThrow();
  });
  it("moves a column without duplicates, serializes only status names and ignores inaccessible storage", () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    const next = reorderColumn(KANBAN_STATUSES, "Cerrado", "Contactado");
    expect(next).toEqual(["Cerrado", "Contactado", "Interesado", "Reunión agendada", "Sin respuesta", "Respuesta negativa"]);
    expect(reorderColumn(next, "Cerrado", "Cerrado")).toEqual(next);
    saveColumnOrder(next, storage); expect(storage.setItem).toHaveBeenCalledExactlyOnceWith("crm:kanban-column-order:v1", JSON.stringify(next));
    expect(readColumnOrder(null)).toEqual(KANBAN_STATUSES); expect(() => saveColumnOrder(next, null)).not.toThrow();
  });
});
