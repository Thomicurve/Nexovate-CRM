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
vi.mock("@/app/(crm)/clientes/actions", () => ({ moveClient: f.move, saveClient: vi.fn(), deleteClient: vi.fn() }));
vi.mock("@/app/(crm)/clientes/comment-actions", () => ({ loadClientComments: vi.fn(async () => ({ kind: "found", rows: [], next: null, userId: "11111111-1111-4111-8111-111111111111" })), createClientComment: vi.fn(), archiveClientComment: vi.fn() }));
describe("shared client views and approved board controls", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.restoreAllMocks(); vi.clearAllMocks(); f.move.mockReset();
    localStorage.clear();
    vi.stubGlobal("matchMedia", (media: string) => ({ matches: media.includes(": reduce"), media, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
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
  it("offers column ordering by keyboard menu with focus return and no business writes", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    const trigger = screen.getByRole("button", { name: "Ordenar etapa Interesado" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    trigger.focus(); await user.keyboard("[Enter]");
    const menu = screen.getByRole("menu", { name: "Ordenar etapa Interesado" });
    const left = within(menu).getByRole("menuitem", { name: "Mover a la izquierda" });
    expect(left).toHaveFocus();
    await user.keyboard("[Escape]"); expect(trigger).toHaveFocus();
    await user.click(trigger); await user.click(screen.getByRole("menuitem", { name: "Mover a la izquierda" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Interesado", "Contactado", ...order.slice(2)]);
    expect(trigger).toHaveFocus(); expect(f.move).not.toHaveBeenCalled(); expect(f.refresh).not.toHaveBeenCalled();
  });
  it("starts with populated results and remembers an explicitly selected empty stage", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    const result = { kind: "found" as const, filters: parsed.filters, rows: [{ ...confirmed, status: "Interesado" as const }], count: 1 };
    const first = render(<ClientList result={result} />);
    const stage = (name: string) => within(screen.getByRole("radiogroup", { name: "Estado visible" })).getByRole("radio", { name: new RegExp(`^${name},`) });
    await waitFor(() => expect(stage("Interesado")).toHaveAttribute("aria-checked", "true"));
    stage("Interesado").focus(); await user.keyboard("[ArrowDown]");
    expect(stage("Cerrado")).toHaveFocus(); expect(stage("Cerrado")).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("crm:kanban-mobile-stage:v1")).toBe(JSON.stringify("Cerrado"));
    first.unmount(); render(<ClientList result={result} />);
    await waitFor(() => expect(stage("Cerrado")).toHaveAttribute("aria-checked", "true"));
    expect(f.move).not.toHaveBeenCalled(); expect(f.refresh).not.toHaveBeenCalled();
  });
  it("shows only real optional card metadata with explicit contact and meeting labels", () => {
    const parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, count: 2, rows: [confirmed,
      { ...confirmed, id: "33333333-3333-4333-8333-333333333333", name: "Completo", company: "Empresa extensa",
        rubro: "Servicios", meeting_at: "2026-10-08T15:30:00Z", notes: "Datos", email: "persona@example.com", phone: "123456" }] }} />);
    const empty = screen.getByRole("button", { name: "Abrir Confirmado" });
    expect(within(empty).getByText(/^Contacto:/)).toBeInTheDocument();
    expect(within(empty).queryByText(/Sin empresa|Sin informar|Reunión:|Notas|Email|Teléfono/)).not.toBeInTheDocument();
    expect(within(empty).queryByText("Contactado")).not.toBeInTheDocument();
    const full = screen.getByRole("button", { name: "Abrir Completo" });
    for (const value of ["Empresa extensa", "Servicios", "Email", "Teléfono"]) expect(within(full).getByText(value)).toBeInTheDocument();
    expect(within(full).queryByText("Notas")).not.toBeInTheDocument();
    expect(within(full).getByText(/^Reunión:/)).toBeInTheDocument();
    expect(within(full).queryByRole("link")).not.toBeInTheDocument();
  });
  it("defaults to six Kanban columns and selects the same filtered, paged dataset in table", async () => {
    const parsed = parseFilters({ nombre: "Confirmado", estado: ["Contactado", "Cerrado"], pagina: "2" });
    if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 51 }} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const board = screen.getByRole("region", { name: "Kanban de clientes" });
    expect(within(board).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(order);
    for (const state of STATUSES) expect(within(board).getByRole("heading", { name: state })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Kanban" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Arrastrar cliente Confirmado" })).toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("link", { name: "Editar Confirmado" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir Confirmado" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Tabla" }));
    expect(window.location.pathname + window.location.search).toBe("/clientes?nombre=Confirmado&estado=Contactado&estado=Cerrado&pagina=2&vista=tabla");
    expect(screen.getByRole("table")).toHaveTextContent("Confirmado");
  });
  it("mobile visible-state control selects any column without changing shared filters or writing", async () => {
    const user = userEvent.setup(), parsed = parseFilters({ estado: "Contactado" });
    if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    const visible = screen.getByRole("radiogroup", { name: "Estado visible" });
    expect(within(visible).getAllByRole("radio")).toHaveLength(6);
    expect(within(visible).getAllByRole("radio").map((option) => option.getAttribute("aria-label")?.split(",")[0])).toEqual(order);
    await user.click(within(visible).getByRole("radio", { name: /^Interesado,/ }));
    expect(within(visible).getByRole("radio", { name: /^Interesado,/ })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "Tabla" }));
    expect(window.location.pathname + window.location.search).toBe("/clientes?estado=Contactado&vista=tabla");
    expect(f.move).not.toHaveBeenCalled();
  });
  it("opens comments by card click or keyboard, edits from details and returns focus to that card", async () => {
    const user = userEvent.setup(), parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [{ ...confirmed, notes: "Datos completos" }], count: 1 }} />);
    const card = screen.getByRole("button", { name: "Abrir Confirmado" });
    for (const activate of [() => user.click(card), () => { card.focus(); return user.keyboard("[Enter]"); }]) {
      await activate();
      const detail = screen.getByRole("dialog", { name: "Confirmado" });
      expect(within(detail).getByRole("textbox", { name: "Nuevo comentario" })).toBeVisible();
      expect(screen.queryByRole("dialog", { name: "Editar cliente" })).not.toBeInTheDocument();
      await user.click(within(detail).getByRole("link", { name: "Editar Confirmado" }));
      expect(screen.getByRole("dialog", { name: "Editar cliente" })).toBeVisible();
      expect(screen.queryByLabelText("Notas")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Nombre *")).toHaveValue("Confirmado");
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => { expect(card).toHaveFocus(); expect(document.body.style.overflow).not.toBe("hidden"); });
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
    expect(within(screen.getByRole("radiogroup", { name: "Estado visible" })).getAllByRole("radio").map((option) => option.getAttribute("aria-label")?.split(",")[0])).toEqual(expected);
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
    range.selectNodeContents(screen.getByText(/^Contacto:/)); window.getSelection()!.addRange(range);
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
    expect(screen.getByRole("heading", { name: "Moviendo cliente…" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Tabla" })).toBeDisabled();
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
    expect(await screen.findByText("Estado actualizado")).toBeInTheDocument();
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
    expect(await screen.findByText("Estado actualizado")).toBeInTheDocument();
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
    expect(screen.getByRole("radio", { name: "Tabla" })).toBeEnabled();
    expect(screen.queryByText("Soltar aquí")).not.toBeInTheDocument();
  });
  it("starts pointer dragging from the card body and clears destination on outside/cancel", async () => {
    class TestPointerEvent extends MouseEvent { isPrimary = true; pointerId = 1; pointerType = "mouse"; }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    const parsed = parseFilters({}); if (!parsed.ok) throw new Error("valid filters");
    render(<ClientList result={{ kind: "found", filters: parsed.filters, rows: [confirmed], count: 1 }} />);
    fireEvent.pointerDown(screen.getByText(/^Contacto:/), { clientX: 150, clientY: 290, button: 0, isPrimary: true });
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
    for (const target of [screen.getByRole("button", { name: "Abrir Confirmado" }), screen.getByText(/^Contacto:/)]) {
      fireEvent.pointerDown(target, { clientX: 150, clientY: 300, button: 0, shiftKey: true });
      fireEvent.pointerMove(document, { clientX: 410, clientY: 300 }); fireEvent.pointerUp(document);
      expect(screen.queryByText("Soltar aquí")).not.toBeInTheDocument();
    }
    const range = document.createRange(); range.selectNodeContents(screen.getByText(/^Contacto:/));
    window.getSelection()!.addRange(range);
    fireEvent.pointerDown(screen.getByText(/^Contacto:/), { clientX: 150, clientY: 300, button: 0 });
    fireEvent.pointerMove(document, { clientX: 410, clientY: 300 }); fireEvent.pointerUp(document);
    expect(screen.queryByText("Soltar aquí")).not.toBeInTheDocument();
    expect(window.getSelection()!.toString()).toMatch(/^Contacto:/);
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
