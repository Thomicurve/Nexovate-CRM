import { WithLoading } from "../ui/loading-test-support";
import { act, fireEvent, render as renderUi, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { NotificationProvider } from "@/components/ui/notifications";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientList } from "@/components/clients/client-list";
import { parseFilters } from "@/lib/clients/filters";
import { STATUSES } from "@/lib/clients/model";
import { clientId, confirmed } from "./fixture";
import type { MoveResult } from "@/lib/clients/moves";

const f = vi.hoisted(() => ({ refresh: vi.fn(), move: vi.fn() }));
const order = ["Contactado", "Interesado", "Reunión agendada", "Cerrado", "Sin respuesta", "Respuesta negativa"];
const render = (ui: ReactNode) => renderUi(ui, { wrapper: ({ children }) => <NotificationProvider><WithLoading>{children}</WithLoading></NotificationProvider> });
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: f.refresh }) }));
vi.mock("@/app/(crm)/clientes/actions", () => ({ moveClient: f.move, saveClient: vi.fn() }));
describe("shared client views and approved board controls", () => {
  beforeEach(() => {
    vi.restoreAllMocks(); vi.clearAllMocks(); f.move.mockReset();
    localStorage.clear();
    window.getSelection()?.removeAllRanges();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const column = this.closest<HTMLElement>("[data-column]");
      const index = column ? Array.from(column.parentElement!.children).indexOf(column) : -1;
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
    expect(within(board).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(order);
    for (const state of STATUSES) expect(within(board).getByRole("heading", { name: state })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tabla" })).toHaveAttribute("href",
      "/clientes?nombre=Confirmado&estado=Contactado&estado=Cerrado&pagina=2&vista=tabla");
    expect(screen.getByRole("link", { name: "Kanban" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Arrastrar cliente Confirmado" })).toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("link", { name: "Editar Confirmado" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir Confirmado" })).toBeInTheDocument();
  });
  it("mobile visible-state control selects any column without changing shared filters or writing", async () => {
    const user = userEvent.setup(), parsed = parseFilters({ estado: "Contactado" });
    if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    const visible = screen.getByRole("combobox", { name: "Estado visible" });
    expect(within(visible).getAllByRole("option")).toHaveLength(6);
    expect(within(visible).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(order);
    await user.selectOptions(visible, "Interesado");
    expect(visible).toHaveValue("Interesado");
    expect(screen.getByRole("link", { name: "Tabla" })).toHaveAttribute("href", "/clientes?estado=Contactado&vista=tabla");
    expect(f.move).not.toHaveBeenCalled();
  });
  it("opens full editable row data by card click or keyboard and returns focus to that card", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [{ ...confirmed, notes: "Datos completos" }], count: 1 }} />);
    const card = screen.getByRole("button", { name: "Abrir Confirmado" });
    for (const activate of [() => user.click(card), () => { card.focus(); return user.keyboard("[Enter]"); }]) {
      await activate();
      expect(screen.getByRole("dialog", { name: "Editar cliente" })).toBeVisible();
      expect(screen.getByLabelText("Notas")).toHaveValue("Datos completos");
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(card).toHaveFocus();
    }
    expect(f.move).not.toHaveBeenCalled(); expect(f.refresh).not.toHaveBeenCalled();
  });
  it("reorders columns by keyboard, persists only on change and uses that order for client movement", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    const handle = screen.getByRole("button", { name: "Arrastrar columna Cerrado" }); handle.focus();
    await user.keyboard("[Space][ArrowLeft][ArrowLeft][Space]");
    const expected = ["Contactado", "Cerrado", "Interesado", "Reunión agendada", "Sin respuesta", "Respuesta negativa"];
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(expected);
    expect(JSON.parse(localStorage.getItem("crm:kanban-column-order:v1")!)).toEqual(expected);
    expect(within(screen.getByRole("combobox", { name: "Estado visible" })).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(expected);
    f.move.mockResolvedValue({ kind: "error", retry: true, message: "Intención conservada" });
    screen.getByRole("button", { name: "Arrastrar cliente Confirmado" }).focus();
    await user.keyboard("[Space][ArrowRight][Space]");
    await waitFor(() => expect(f.move).toHaveBeenCalledOnce());
    expect(f.move.mock.calls[0][0].to).toBe("Cerrado");
    expect(screen.getByRole("button", { name: "Arrastrar columna Contactado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Abrir Confirmado" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("does not open when pointer default selection clears a previously selected card text", () => {
    class TestPointerEvent extends MouseEvent { isPrimary = true; pointerId = 1; pointerType = "mouse"; }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    const parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    const card = screen.getByRole("button", { name: "Abrir Confirmado" }), range = document.createRange();
    range.selectNodeContents(screen.getByText("Rubro: Sin informar")); window.getSelection()!.addRange(range);
    expect(window.getSelection()!.isCollapsed).toBe(false);
    fireEvent.pointerDown(card, { button: 0 }); window.getSelection()!.removeAllRanges(); fireEvent.click(card);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(f.move).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("keyboard move persists only after confirmation, preserves pending intent across incoming snapshots, and restores focus", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    let resolve!: (result: MoveResult) => void;
    f.move.mockImplementation(() => new Promise<MoveResult>((done) => { resolve = done; }));
    const result = { kind: "found" as const, filters: parsed.filters, rows: [confirmed], count: 1 };
    const { rerender } = render(<ClientList result={result} />);
    const handle = screen.getByRole("button", { name: "Arrastrar cliente Confirmado" }); handle.focus();
    await user.keyboard("[Space][ArrowRight]");
    expect(screen.getByText("Soltar aquí")).toBeVisible();
    await user.keyboard("[Space]");
    await waitFor(() => expect(f.move).toHaveBeenCalledOnce());
    expect(f.move.mock.calls[0][0]).toMatchObject({ clientId, version: 2, from: "Contactado", to: "Interesado" });
    expect(screen.queryByText("Soltar aquí")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Cargando" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tabla" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeDisabled();
    act(() => {
      window.history.replaceState(null, "", "/clientes?vista=tabla");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("region", { name: "Kanban de clientes" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
    rerender(<ClientList result={{ ...result, rows: [] }} />);
    expect(screen.getByRole("dialog", { name: "Cargando" })).toBeInTheDocument();
    expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    await act(async () => resolve({ kind: "success", client: { ...confirmed, status: "Interesado", version: 3 } }));
    expect(screen.getByText("Estado actualizado")).toBeInTheDocument();
    expect(screen.getByText("Confirmado · Interesado")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Kanban de clientes" })).toHaveFocus();
    expect(f.refresh).toHaveBeenCalledOnce();
  });
  it("rolls back an ambiguous move, locks new navigation and retries exactly the same intent", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    f.move.mockResolvedValueOnce({ kind: "error", retry: true, message: "Cambio sin confirmar" })
      .mockResolvedValueOnce({ kind: "success", client: { ...confirmed, status: "Interesado", version: 3 } });
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    screen.getByRole("button", { name: "Arrastrar cliente Confirmado" }).focus();
    await user.keyboard("[Enter][ArrowRight][Enter]");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cambio sin confirmar"));
    expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intentar de nuevo" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Filtros de clientes" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    await waitFor(() => expect(f.move).toHaveBeenCalledTimes(2));
    expect(f.move.mock.calls[0]).toEqual(f.move.mock.calls[1]);
    expect(screen.getByText("Estado actualizado")).toBeInTheDocument();
  });
  it("Escape and same-column drop preserve the card without invoking a write", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    const handle = screen.getByRole("button", { name: "Arrastrar cliente Confirmado" }); handle.focus();
    await user.keyboard("[Space][ArrowRight][Escape]");
    expect(f.move).not.toHaveBeenCalled(); expect(handle).toHaveFocus();
    await user.keyboard("[Enter][Enter]");
    expect(f.move).not.toHaveBeenCalled();
    expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tabla" })).toHaveAttribute("aria-disabled", "false");
    expect(screen.queryByText("Soltar aquí")).not.toBeInTheDocument();
  });
  it("starts pointer dragging from the card body and clears destination on outside/cancel", async () => {
    class TestPointerEvent extends MouseEvent { isPrimary = true; pointerId = 1; pointerType = "mouse"; }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    const parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    fireEvent.pointerDown(screen.getByText("Rubro: Sin informar"), { clientX: 150, clientY: 290, button: 0, isPrimary: true });
    fireEvent.pointerMove(document, { clientX: 410, clientY: 300 });
    fireEvent.pointerMove(document, { clientX: 411, clientY: 300 });
    await waitFor(() => expect(screen.getByText("Soltar aquí")).toBeVisible());
    fireEvent.pointerMove(document, { clientX: 0, clientY: 0 });
    await waitFor(() => expect(screen.queryByText("Soltar aquí")).not.toBeInTheDocument());
    fireEvent.keyDown(document, { code: "Escape" });
    fireEvent.pointerUp(document);
    expect(f.move).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("preserves interactive edit clicks, selected text and Shift-selection without activating body drag", async () => {
    class TestPointerEvent extends MouseEvent { isPrimary = true; pointerId = 1; pointerType = "mouse"; }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    const parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    for (const target of [screen.getByRole("button", { name: "Abrir Confirmado" }), screen.getByText("Rubro: Sin informar")]) {
      fireEvent.pointerDown(target, { clientX: 150, clientY: 300, button: 0, shiftKey: true });
      fireEvent.pointerMove(document, { clientX: 410, clientY: 300 }); fireEvent.pointerUp(document);
      expect(screen.queryByText("Soltar aquí")).not.toBeInTheDocument();
    }
    const range = document.createRange(); range.selectNodeContents(screen.getByText("Rubro: Sin informar"));
    window.getSelection()!.addRange(range);
    fireEvent.pointerDown(screen.getByText("Rubro: Sin informar"), { clientX: 150, clientY: 300, button: 0 });
    fireEvent.pointerMove(document, { clientX: 410, clientY: 300 }); fireEvent.pointerUp(document);
    expect(screen.queryByText("Soltar aquí")).not.toBeInTheDocument();
    expect(window.getSelection()!.toString()).toBe("Rubro: Sin informar");
    window.getSelection()!.removeAllRanges(); vi.unstubAllGlobals();
    expect(f.move).not.toHaveBeenCalled();
  });
  it("shows the partner snapshot after conflict and offers a conscious edit without auto retry", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    f.move.mockResolvedValue({ kind: "conflict", confirmed: { ...confirmed, status: "Interesado", version: 3 } });
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    screen.getByRole("button", { name: "Arrastrar cliente Confirmado" }).focus();
    await user.keyboard("[Space][ArrowRight][Space]");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("versión confirmada"));
    expect(screen.getByRole("link", { name: "Volver a editar" })).toHaveAttribute("href", expect.stringContaining(`/clientes/${clientId}/editar`));
    expect(screen.queryByRole("button", { name: "Intentar de nuevo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    expect(f.move).toHaveBeenCalledOnce(); expect(f.refresh).toHaveBeenCalledOnce();
  });
});
