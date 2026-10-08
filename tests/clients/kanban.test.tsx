import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientList } from "@/components/clients/client-list";
import { parseFilters } from "@/lib/clients/filters";
import { STATUSES } from "@/lib/clients/model";
import { clientId, confirmed } from "./fixture";
import type { MoveResult } from "@/lib/clients/moves";

const f = vi.hoisted(() => ({ refresh: vi.fn(), move: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: f.refresh }) }));
vi.mock("@/app/(crm)/clientes/actions", () => ({ moveClient: f.move }));
describe("shared client views and approved board controls", () => {
  beforeEach(() => {
    vi.restoreAllMocks(); vi.clearAllMocks(); f.move.mockReset();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const column = this.closest<HTMLElement>("[data-column]");
      const index = STATUSES.indexOf(column?.dataset.column as typeof STATUSES[number]);
      return this.dataset.column ? new DOMRect(100 + index * 250, 200, 230, 677) :
        this.dataset.client ? new DOMRect(110 + index * 250, 250, 210, 212) : new DOMRect(120 + Math.max(0, index) * 250, 390, 150, 44);
    });
  });
  it("defaults to six Kanban columns and links to the same filtered, paged dataset in table", () => {
    const parsed = parseFilters({ nombre: "Confirmado", estado: ["Contactado", "Cerrado"], pagina: "2" });
    if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 51 }} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const board = screen.getByRole("region", { name: "Kanban de clientes" });
    for (const state of STATUSES) expect(within(board).getByRole("heading", { name: state })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tabla" })).toHaveAttribute("href",
      "/clientes?nombre=Confirmado&estado=Contactado&estado=Cerrado&pagina=2&vista=tabla");
    expect(screen.getByRole("link", { name: "Kanban" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Cambiar estado de Confirmado" })).toHaveAttribute("aria-describedby");
    expect(screen.getByRole("link", { name: "Editar Confirmado" })).toHaveAttribute("href", expect.stringContaining("pagina%3D2"));
  });
  it("mobile visible-state control selects any column without changing shared filters or writing", async () => {
    const user = userEvent.setup(), parsed = parseFilters({ estado: "Contactado" });
    if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    const visible = screen.getByRole("combobox", { name: "Estado visible" });
    expect(within(visible).getAllByRole("option")).toHaveLength(6);
    await user.selectOptions(visible, "Interesado");
    expect(visible).toHaveValue("Interesado");
    expect(screen.getByRole("link", { name: "Tabla" })).toHaveAttribute("href", "/clientes?estado=Contactado&vista=tabla");
    expect(f.move).not.toHaveBeenCalled();
  });
  it("keyboard move persists only after confirmation, preserves pending intent across incoming snapshots, and restores focus", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    let resolve!: (result: MoveResult) => void;
    f.move.mockImplementation(() => new Promise<MoveResult>((done) => { resolve = done; }));
    const result = { kind: "found" as const, filters: parsed.filters, rows: [confirmed], count: 1 };
    const { rerender } = render(<ClientList result={result} />);
    const handle = screen.getByRole("button", { name: "Cambiar estado de Confirmado" }); handle.focus();
    await user.keyboard("[Space][ArrowRight][Space]");
    await waitFor(() => expect(f.move).toHaveBeenCalledOnce());
    expect(f.move.mock.calls[0][0]).toMatchObject({ clientId, version: 2, from: "Contactado", to: "Reunión agendada" });
    expect(screen.getByText("Guardando cambio de estado…")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tabla" })).toHaveAttribute("aria-disabled", "true");
    rerender(<ClientList result={{ ...result, rows: [] }} />);
    expect(screen.getByText("Guardando cambio de estado…")).toBeInTheDocument();
    await act(async () => resolve({ kind: "success", client: { ...confirmed, status: "Reunión agendada", version: 3 } }));
    expect(screen.getByText("Cambio de estado guardado.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Kanban de clientes" })).toHaveFocus();
    expect(f.refresh).toHaveBeenCalledOnce();
  });
  it("rolls back an ambiguous move, locks new navigation and retries exactly the same intent", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    f.move.mockResolvedValueOnce({ kind: "error", retry: true, message: "Cambio sin confirmar" })
      .mockResolvedValueOnce({ kind: "success", client: { ...confirmed, status: "Reunión agendada", version: 3 } });
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    screen.getByRole("button", { name: "Cambiar estado de Confirmado" }).focus();
    await user.keyboard("[Enter][ArrowRight][Enter]");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cambio sin confirmar"));
    expect(screen.getByRole("button", { name: "Intentar de nuevo" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Filtros de clientes" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    await waitFor(() => expect(f.move).toHaveBeenCalledTimes(2));
    expect(f.move.mock.calls[0]).toEqual(f.move.mock.calls[1]);
    expect(screen.getByText("Cambio de estado guardado.")).toBeInTheDocument();
  });
  it("Escape and same-column drop preserve the card without invoking a write", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    const handle = screen.getByRole("button", { name: "Cambiar estado de Confirmado" }); handle.focus();
    await user.keyboard("[Space][ArrowRight][Escape]");
    expect(f.move).not.toHaveBeenCalled(); expect(handle).toHaveFocus();
    await user.keyboard("[Enter][Enter]");
    expect(f.move).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Tabla" })).toHaveAttribute("aria-disabled", "false");
  });
  it("shows the partner snapshot after conflict and offers a conscious edit without auto retry", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    f.move.mockResolvedValue({ kind: "conflict", confirmed: { ...confirmed, status: "Interesado", version: 3 } });
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    screen.getByRole("button", { name: "Cambiar estado de Confirmado" }).focus();
    await user.keyboard("[Space][ArrowRight][Space]");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("versión confirmada"));
    expect(screen.getByRole("link", { name: "Volver a editar" })).toHaveAttribute("href", expect.stringContaining(`/clientes/${clientId}/editar`));
    expect(screen.queryByRole("button", { name: "Intentar de nuevo" })).not.toBeInTheDocument();
    expect(f.move).toHaveBeenCalledOnce(); expect(f.refresh).toHaveBeenCalledOnce();
  });
});
