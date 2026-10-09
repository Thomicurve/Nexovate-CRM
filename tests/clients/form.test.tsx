import { act, render as renderUi, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { NotificationProvider } from "@/components/ui/notifications";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientForm } from "@/components/clients/client-form";
import type { SaveState } from "@/lib/clients/model";
import { confirmed, requestId } from "./fixture";

const props = { requestId, initialContact: "2026-10-07T12:30", returnTo: "/clientes?nombre=Socio" };
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: navigation.replace }) }));
const render = (ui: ReactNode) => renderUi(ui, { wrapper: NotificationProvider });
describe("approved client form interaction", () => {
  beforeEach(() => vi.clearAllMocks());
  it("delivers a confirmed save through a modal callback without route navigation", async () => {
    const onSuccess = vi.fn(), onLockChange = vi.fn();
    render(<ClientForm {...props} action={vi.fn().mockResolvedValue({ status: "success", client: confirmed })}
      onSuccess={onSuccess} onLockChange={onLockChange} onCancel={vi.fn()} embedded />);
    await userEvent.click(screen.getByRole("button", { name: "Crear cliente" }));
    await screen.findByRole("button", { name: "Guardado" });
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(confirmed);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(onLockChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
  it.each([undefined, confirmed])("returns to safe filtered list only after confirmed save, edit=%s", async (client) => {
    const action = vi.fn().mockResolvedValue({ status: "success", client: confirmed });
    render(<ClientForm {...props} client={client} action={action} />);
    await userEvent.click(screen.getByRole("button", { name: client ? "Guardar cambios" : "Crear cliente" }));
    await screen.findByRole("button", { name: "Guardado" });
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith(props.returnTo);
    expect(screen.getByRole("status")).toHaveTextContent(client ? "Cliente actualizado" : "Cliente creado");
    expect(screen.getByRole("status")).toHaveTextContent(confirmed.name);
    expect(screen.getByRole("button", { name: "Guardado" })).toBeDisabled();
  });
  it.each(["error", "invalid", "conflict", "success"])("does not navigate an unconfirmed %s outcome", async (status) => {
    render(<ClientForm {...props} action={vi.fn().mockResolvedValue({ status, message: "Sin confirmar" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Crear cliente" }));
    await screen.findByRole("alert");
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("normalizes an unsafe destination and emits one confirmed notification", async () => {
    render(<ClientForm {...props} returnTo="https://evil.invalid/?guardado=1" action={vi.fn().mockResolvedValue({ status: "success", client: confirmed })} />);
    await userEvent.click(screen.getByRole("button", { name: "Crear cliente" }));
    await screen.findByRole("button", { name: "Guardado" });
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/clientes");
    expect(screen.getAllByText("Cliente creado")).toHaveLength(1);
  });
  it("renders approved order/labels, create Contactado and optional fields", () => {
    render(<ClientForm {...props} action={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Nuevo cliente" })).toBeVisible();
    expect(screen.queryByLabelText("Estado")).toBeNull();
    expect(screen.getByLabelText("Nombre *")).toHaveAttribute("required");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("required");
    expect(screen.getByLabelText("Fecha de contacto *")).toHaveValue(props.initialContact);
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute("href", props.returnTo);
  });
  it("uses accessible six-state select for edit and preserves confirmed contact precision", () => {
    render(<ClientForm {...props} client={confirmed} action={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Estado" })).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(6);
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Confirmado");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
  });
  it("announces pending and freezes duplicate submits", async () => {
    let finish!: (state: SaveState) => void;
    const action = vi.fn(() => new Promise<SaveState>((resolve) => { finish = resolve; }));
    render(<ClientForm {...props} action={action} />);
    const user = userEvent.setup(); await user.type(screen.getByLabelText("Nombre *"), "Prospecto");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Guardando cliente…");
    await act(async () => finish({ status: "error", message: "Conexión", retry: true }));
  });
  it("retains entered data, locks same intent after ambiguous error and reuses request UUID", async () => {
    const action = vi.fn().mockResolvedValue({ status: "error", message: "Conexión", retry: true });
    render(<ClientForm {...props} action={action} />);
    const user = userEvent.setup(); await user.type(screen.getByLabelText("Nombre *"), "Conservar");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));
    await screen.findByRole("alert"); expect(screen.getByLabelText("Nombre *")).toHaveValue("Conservar");
    expect(screen.getByLabelText("Nombre *")).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(action.mock.calls[0][1].get("request_id")).toBe(action.mock.calls[1][1].get("request_id"));
    expect(action.mock.calls[0][1].get("name")).toBe(action.mock.calls[1][1].get("name"));
  });
  it("shows current confirmed version on conflict and requires conscious resume", async () => {
    const action = vi.fn().mockResolvedValue({ status: "conflict", confirmed });
    render(<ClientForm {...props} client={{ ...confirmed, version: 1 }} action={action} />);
    const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Este cliente se actualizó mientras lo editabas.");
    expect(screen.getByText("Versión confirmada: 2")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Volver a editar" }));
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Confirmado");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
  });
  it("creates a new intent after correcting a definite validation failure", async () => {
    const action = vi.fn().mockResolvedValue({ status: "invalid", errors: { name: "Nombre obligatorio" }, message: "Revisá" });
    render(<ClientForm {...props} action={action} />);
    const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Crear cliente" }));
    await screen.findByRole("alert"); await user.type(screen.getByLabelText("Nombre *"), "Corregido");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));
    expect(action.mock.calls[0][1].get("request_id")).not.toBe(action.mock.calls[1][1].get("request_id"));
  });
  it("preserves intent when browser transport of the action rejects", async () => {
    const action = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ClientForm {...props} action={action} />);
    const user = userEvent.setup(); await user.type(screen.getByLabelText("Nombre *"), "Conservar" );
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reintentá con los mismos datos");
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Conservar");
    expect(screen.getByLabelText("Nombre *")).toHaveAttribute("readonly");
  });
});
