import type { ReactNode } from "react";
import { WithLoading } from "../ui/loading-test-support";
import { act, render as renderUi, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientList } from "@/components/clients/client-list";
import { saveClient } from "@/app/(crm)/clientes/actions";
import { parseFilters } from "@/lib/clients/filters";
import { confirmed } from "./fixture";
vi.mock("@/app/(crm)/clientes/actions", () => ({ moveClient: vi.fn(), saveClient: vi.fn(), deleteClient: vi.fn() }));
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const parsed = parseFilters({ nombre: "Confirmado", estado: "Contactado", desde: "2026-10-07", vista: "tabla" });
if (!parsed.ok) throw new Error("valid fixture filters");
const filters = parsed.filters;
const render = (ui: ReactNode) => renderUi(ui, { wrapper: WithLoading });

describe("client table and filter accessibility", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
  });
  it("opens create and edit locally with full row data and returns to the same opener", async () => {
    const user = userEvent.setup();
    render(<ClientList result={{ kind: "found", filters, rows: [{ ...confirmed, notes: "Notas completas", email: "persona@example.com" }], count: 1 }} />);
    const opener = screen.getByRole("link", { name: "Editar Confirmado" });
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Editar cliente" })).toBeInTheDocument();
    expect(screen.getByLabelText("Notas")).toHaveValue("Notas completas");
    expect(screen.getByLabelText("Email")).toHaveValue("persona@example.com");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await screen.findByRole("link", { name: "Editar Confirmado" });
    await new Promise((resolve) => setTimeout(resolve, 230));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    await user.click(screen.getByRole("link", { name: "Nuevo cliente" }));
    expect(screen.getByRole("dialog", { name: "Nuevo cliente" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre *")).toHaveValue("");
    expect(screen.queryByLabelText("Estado")).not.toBeInTheDocument();
  });
  it("switches presentation locally and restores browser history without refreshing data or losing drafts", async () => {
    const user = userEvent.setup();
    const paged = { ...filters, page: 2 };
    render(<ClientList result={{ kind: "found", filters: paged, rows: [confirmed], count: 101 }} />);
    await user.type(screen.getByLabelText("Nombre"), " draft");
    await user.click(screen.getByRole("link", { name: "Kanban" }));
    expect(screen.getByRole("region", { name: "Kanban de clientes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Confirmado draft");
    expect(window.location.search).toContain("pagina=2");
    expect(window.location.search).not.toContain("vista=tabla");
    act(() => { window.history.replaceState(null, "", "/clientes?pagina=2&vista=tabla"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getByRole("table", { name: "Clientes" })).toHaveTextContent("Confirmado");
    expect(screen.getByText("Página 2 · 101 clientes")).toBeVisible();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });
  it.each([false, true])("recovers focus after a saved row disappears, preserving a later user focus (%s)", async (keepFocus) => {
    const user = userEvent.setup();
    const result = { kind: "found" as const, filters, rows: [confirmed], count: 1 };
    vi.mocked(saveClient).mockResolvedValueOnce({ status: "success", client: { ...confirmed, name: "Fuera del filtro" } });
    const { rerender } = render(<ClientList result={result} />);
    await user.click(screen.getByRole("link", { name: "Editar Confirmado" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await new Promise((resolve) => setTimeout(resolve, 230));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cargando" })).toBeNull());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const chosen = screen.getByRole("link", { name: "Nuevo cliente" });
    if (keepFocus) chosen.focus();
    rerender(<ClientList result={{ ...result, rows: [], count: 0 }} />);
    expect(keepFocus ? chosen : screen.getByRole("link", { name: "Tabla" })).toHaveFocus();
  });
  it("refreshes once, retains the last page on failure and supports recovery with the same filters", async () => {
    navigation.refresh.mockClear();
    let finish!: () => void;
    navigation.refresh.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    const result = { kind: "found" as const, filters, rows: [confirmed], count: 1 };
    const { rerender } = render(<ClientList result={result} />);
    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    await user.click(screen.getByRole("button", { name: /Actualizando/ }));
    expect(navigation.refresh).toHaveBeenCalledOnce();
    rerender(<ClientList result={{ kind: "unavailable", filters }} />);
    await act(async () => finish());
    expect(screen.getByRole("table")).toHaveTextContent("Confirmado");
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos actualizar los clientes");
    await user.click(screen.getByRole("button", { name: "Reintentar actualización" }));
    expect(navigation.refresh).toHaveBeenCalledTimes(2);
    rerender(<ClientList result={{ ...result, rows: [{ ...confirmed, name: "Actualizado" }] }} />);
    expect(screen.getByRole("table")).toHaveTextContent("Actualizado");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Confirmado");
  });
  it("recovers when a refresh transition finishes without receiving a server snapshot", async () => {
    let finish!: () => void;
    navigation.refresh.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<ClientList result={{ kind: "found", filters, rows: [confirmed], count: 1 }} />);
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos actualizar");
    expect(screen.getByRole("table")).toHaveTextContent("Confirmado");
  });
  it("renders agreed columns, BA dates, optional fields and filter-preserving edit/create links", () => {
    render(<ClientList result={{ kind: "found", filters, rows: [confirmed], count: 1 }} />);
    const table = screen.getByRole("table", { name: "Clientes" });
    for (const name of ["Cliente", "Rubro", "Estado", "Contacto", "Cita", "Acciones"]) {
      expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(within(table).getByText("07/10/2026 12:30")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar Confirmado" })).toHaveAttribute("href", expect.stringContaining("returnTo=%2Fclientes%3Fnombre%3DConfirmado"));
    expect(screen.getByRole("link", { name: "Nuevo cliente" })).toHaveAttribute("href", expect.stringContaining("returnTo="));
  });
  it("allows keyboard-open filters, multiple states, apply/clear/cancel without losing applied URL", async () => {
    const user = userEvent.setup();
    render(<ClientList result={{ kind: "found", filters, rows: [], count: 0 }} />);
    await user.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.getByRole("region", { name: "Filtrar clientes" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Confirmado");
    expect(screen.getByLabelText("Nombre")).toHaveFocus();
    await user.click(screen.getByRole("checkbox", { name: "Cerrado" }));
    expect(screen.getByRole("checkbox", { name: "Contactado" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Cerrado" })).toBeChecked();
    expect(screen.getByRole("link", { name: "Limpiar filtros" })).toHaveAttribute("href", "/clientes?vista=tabla");
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toHaveAttribute("type", "submit");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("region", { name: "Filtrar clientes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveFocus();
  });
  it("distinguishes empty CRM, no matches, invalid range and unavailable query", () => {
    const empty = parseFilters({ vista: "tabla" });
    if (!empty.ok) throw new Error("valid filters");
    const { rerender } = render(<ClientList result={{ kind: "found", filters: empty.filters, rows: [], count: 0 }} />);
    expect(screen.getByText("Todavía no hay clientes.")).toBeInTheDocument();
    rerender(<ClientList result={{ kind: "found", filters, rows: [], count: 0 }} />);
    expect(screen.getByText("No hay clientes que coincidan con los filtros.")).toBeInTheDocument();
    rerender(<ClientList result={{ kind: "invalid", message: "Revisá el rango de fechas." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Revisá el rango de fechas.");
    rerender(<ClientList result={{ kind: "unavailable", filters }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los clientes.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });
  it("paginates beyond the API page while preserving every applied filter", () => {
    render(<ClientList result={{ kind: "found", filters: { ...filters, page: 2 }, rows: [confirmed], count: 101 }} />);
    const navigation = screen.getByRole("navigation", { name: "Páginas de clientes" });
    expect(within(navigation).getByRole("link", { name: "Anterior" })).toHaveAttribute("href", "/clientes?nombre=Confirmado&estado=Contactado&desde=2026-10-07&vista=tabla");
    expect(within(navigation).getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", "/clientes?nombre=Confirmado&estado=Contactado&desde=2026-10-07&pagina=3&vista=tabla");
    expect(screen.getByRole("link", { name: "Editar Confirmado" })).toHaveAttribute("href", expect.stringContaining("pagina%3D2"));
  });
  it("offers a keyboard-accessible first-page recovery with filters and no fabricated empty result", async () => {
    const user = userEvent.setup();
    render(<ClientList result={{ kind: "out_of_range", filters: { ...filters, page: 2 } }} />);
    expect(screen.getByText("Esta página ya no tiene resultados.")).toBeInTheDocument();
    expect(screen.queryByText("No pudimos cargar los clientes.")).not.toBeInTheDocument();
    expect(screen.queryByText("No hay clientes que coincidan con los filtros.")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Páginas de clientes" })).not.toBeInTheDocument();
    const recovery = screen.getByRole("link", { name: "Volver a la primera página" });
    expect(recovery).toHaveAttribute("href", "/clientes?nombre=Confirmado&estado=Contactado&desde=2026-10-07&vista=tabla");
    for (let index = 0; index < 20 && document.activeElement !== recovery; index++) await user.tab();
    expect(recovery).toHaveFocus();
  });
});
