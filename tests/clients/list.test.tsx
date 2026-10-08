import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ClientList } from "@/components/clients/client-list";
import { parseFilters } from "@/lib/clients/filters";
import { confirmed } from "./fixture";

const parsed = parseFilters({ nombre: "Confirmado", estado: "Contactado", desde: "2026-10-07" });
if (!parsed.ok) throw new Error("valid fixture filters");
const filters = parsed.filters;
describe("client table and filter accessibility", () => {
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
    expect(screen.getByRole("link", { name: "Limpiar filtros" })).toHaveAttribute("href", "/clientes");
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toHaveAttribute("type", "submit");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("region", { name: "Filtrar clientes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveFocus();
  });
  it("distinguishes empty CRM, no matches, invalid range and unavailable query", () => {
    const empty = parseFilters({});
    if (!empty.ok) throw new Error("valid filters");
    const { rerender } = render(<ClientList result={{ kind: "found", filters: empty.filters, rows: [], count: 0 }} />);
    expect(screen.getByText("Todavía no hay clientes.")).toBeInTheDocument();
    rerender(<ClientList result={{ kind: "found", filters, rows: [], count: 0 }} />);
    expect(screen.getByText("No hay clientes que coincidan con los filtros.")).toBeInTheDocument();
    rerender(<ClientList result={{ kind: "invalid", message: "Revisá el rango de fechas." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Revisá el rango de fechas.");
    rerender(<ClientList result={{ kind: "unavailable", filters }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los clientes.");
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute("href", expect.stringContaining("nombre=Confirmado"));
  });
  it("paginates beyond the API page while preserving every applied filter", () => {
    render(<ClientList result={{ kind: "found", filters: { ...filters, page: 2 }, rows: [confirmed], count: 101 }} />);
    const navigation = screen.getByRole("navigation", { name: "Páginas de clientes" });
    expect(within(navigation).getByRole("link", { name: "Anterior" })).toHaveAttribute("href", "/clientes?nombre=Confirmado&estado=Contactado&desde=2026-10-07");
    expect(within(navigation).getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", "/clientes?nombre=Confirmado&estado=Contactado&desde=2026-10-07&pagina=3");
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
    expect(recovery).toHaveAttribute("href", "/clientes?nombre=Confirmado&estado=Contactado&desde=2026-10-07");
    for (let index = 0; index < 20 && document.activeElement !== recovery; index++) await user.tab();
    expect(recovery).toHaveFocus();
  });
});
