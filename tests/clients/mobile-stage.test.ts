import { describe, expect, it, vi } from "vitest";
import { KANBAN_STATUSES } from "@/lib/clients/column-order";
import { readMobileStage, saveMobileStage } from "@/lib/clients/mobile-stage";

describe("mobile Kanban stage preference", () => {
  const order = ["Cerrado", ...KANBAN_STATUSES.filter((status) => status !== "Cerrado")] as const;
  const rows = [{ status: "Interesado" as const }, { status: "Contactado" as const }];
  it("starts at the first populated stage in the current order, otherwise the first stage", () => {
    expect(readMobileStage(order, rows, null)).toBe("Contactado");
    expect(readMobileStage(order, [], null)).toBe("Cerrado");
  });
  it("keeps a valid chosen stage even when it is empty and never overwrites storage while reading", () => {
    const storage = { getItem: vi.fn(() => JSON.stringify("Respuesta negativa")), setItem: vi.fn() };
    expect(readMobileStage(order, rows, storage)).toBe("Respuesta negativa");
    expect(storage.setItem).not.toHaveBeenCalled();
    saveMobileStage("Interesado", storage);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith("crm:kanban-mobile-stage:v1", JSON.stringify("Interesado"));
  });
  it("falls back for corrupted, unknown and blocked preferences without preventing navigation", () => {
    const storage = { getItem: vi.fn(() => "broken"), setItem: vi.fn() };
    expect(readMobileStage(order, rows, storage)).toBe("Contactado");
    for (const value of ["unknown", ["Contactado"], { status: "Contactado" }]) {
      storage.getItem.mockReturnValue(JSON.stringify(value));
      expect(readMobileStage(order, rows, storage)).toBe("Contactado");
    }
    storage.getItem.mockImplementation(() => { throw new Error("denied"); });
    storage.setItem.mockImplementation(() => { throw new Error("denied"); });
    expect(readMobileStage(order, rows, storage)).toBe("Contactado");
    expect(() => saveMobileStage("Cerrado", storage)).not.toThrow();
  });
});
