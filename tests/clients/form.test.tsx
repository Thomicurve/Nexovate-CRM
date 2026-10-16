import { WithLoading } from "../ui/loading-test-support";
import { act, render as renderUi, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { NotificationProvider } from "@/components/ui/notifications";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientForm } from "@/components/clients/client-form";
import { normalizeForm, type SaveState } from "@/lib/clients/model";
import { confirmed, requestId } from "./fixture";

const props = { requestId, initialContact: "2026-10-07T12:30", returnTo: "/clientes?nombre=Socio" };
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: navigation.replace }) }));
const render = (ui: ReactNode) => renderUi(ui, { wrapper: ({ children }) => <NotificationProvider><WithLoading>{children}</WithLoading></NotificationProvider> });
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
    expect(screen.getByRole("textbox", { name: "Comentario inicial (opcional)" })).toHaveAttribute("name", "initial_comment");
    expect(screen.queryByLabelText("Notas")).not.toBeInTheDocument();
  });
  it("uses accessible six-state select for edit and preserves confirmed contact precision", () => {
    render(<ClientForm {...props} client={confirmed} action={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Estado" })).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(6);
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Confirmado");
    expect(screen.queryByRole("textbox", { name: "Comentario inicial (opcional)" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Notas")).not.toBeInTheDocument();

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
    expect(await screen.findByRole("alert")).toHaveTextContent("Tus cambios no se guardaron.");
    expect(screen.getByText("Versión confirmada: 2")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Usar datos actuales" }));
    expect(screen.getByLabelText("Nombre *")).toHaveFocus();
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
  it("focuses a linked error summary only after invalid submission", async () => {
    render(<ClientForm {...props} client={confirmed} action={vi.fn().mockResolvedValue({ status: "invalid",
      errors: { name: "Nombre obligatorio", status: "Estado inválido", company: "Empresa demasiado larga" } })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const summary = await screen.findByRole("alert"); expect(summary).toHaveFocus();
    await user.click(screen.getByRole("link", { name: "Estado inválido" }));
    expect(screen.getByLabelText("Estado")).toHaveFocus();
    expect(screen.getByLabelText("Estado")).toHaveAccessibleDescription("Estado inválido");
    await user.click(screen.getByRole("link", { name: "Empresa demasiado larga" }));
    expect(screen.getByLabelText("Empresa")).toHaveFocus();
    await user.type(screen.getByLabelText("Empresa"), " corregida");
    expect(screen.getByLabelText("Empresa")).toHaveFocus();
  });
  it("retains exact initial comment through uncertain retry, including 5000 astral characters", async () => {
    const action = vi.fn().mockResolvedValue({ status: "error", retry: true, message: "Resultado incierto" });
    render(<ClientForm {...props} action={action} />);
    const input = screen.getByLabelText("Comentario inicial (opcional)");
    const value = "🧉".repeat(5000);
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await userEvent.click(screen.getByRole("button", { name: "Crear cliente" }));
    await screen.findByRole("alert");
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveValue(value);
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(action.mock.calls[0][1].get("initial_comment")).toBe(value);
    expect(action.mock.calls[1][1].get("initial_comment")).toBe(value);
    expect(action.mock.calls[0][1].get("request_id")).toBe(action.mock.calls[1][1].get("request_id"));
    expect(action.mock.calls[0][1].has("notes")).toBe(false);
  });
  it.each([true, false])("resumes conflict explicitly with own draft=%s and a fresh confirmed intent", async (own) => {
    const original = { ...confirmed, meeting_at: "2026-10-09T15:30:42.123Z" };
    const current = { ...confirmed, name: "Actual", company: "Empresa actual", contact_at: "2026-10-08T15:31:42.123Z", meeting_at: "2026-10-10T15:31:32.456Z", version: 3 };
    const action = vi.fn().mockResolvedValueOnce({ status: "conflict", confirmed: current })
      .mockResolvedValueOnce({ status: "invalid", errors: { name: "Revisar" } });
    render(<ClientForm {...props} client={original} action={action} />);
    const user = userEvent.setup(); await user.clear(screen.getByLabelText("Nombre *"));
    await user.type(screen.getByLabelText("Nombre *"), "Mi borrador");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("heading", { name: "Este cliente cambió" })).toBeVisible();
    expect(screen.getByText("Mi borrador", { selector: "dd" })).toBeVisible(); expect(screen.getByText("Empresa actual")).toBeVisible();
    await user.click(screen.getByRole("button", { name: own ? "Continuar con mi borrador" : "Usar datos actuales" }));
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Nombre *")).toHaveValue(own ? "Mi borrador" : "Actual");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("alert");
    expect(action.mock.calls[1][1].get("version")).toBe("3");
    expect(action.mock.calls[1][1].get("request_id")).not.toBe(action.mock.calls[0][1].get("request_id"));
    expect(action.mock.calls[1][1].get("original_contact")).toBe(own ? original.contact_at : current.contact_at);
    const normalized = normalizeForm(action.mock.calls[1][1]); expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.payload.contact_at).toBe(own ? original.contact_at : current.contact_at);
      expect(normalized.payload.meeting_at).toBe(own ? original.meeting_at : current.meeting_at);
    }
  });
  it("fails closed when a conflict response has no valid confirmed client", async () => {
    render(<ClientForm {...props} client={confirmed} action={vi.fn().mockResolvedValue({ status: "conflict", confirmed: { ...confirmed, id: "invalid" } })} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Usar datos actuales" })).toBeNull();
    expect(screen.getByLabelText("Nombre *")).toHaveAttribute("readonly");
  });
});

vi.mock("@/components/ui/motion", () => ({ usePanelMotion: vi.fn() }));
