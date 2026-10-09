import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientModal } from "@/components/clients/client-modal";
import type { SaveState } from "@/lib/clients/model";
import { confirmed, requestId } from "./fixture";
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const props = { requestId, initialContact: "2026-10-07T12:30", returnTo: "/clientes?nombre=Confirmado&pagina=2&vista=tabla" };
function dialogMethods() {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
}
describe("client modal lifecycle and guarded form", () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); dialogMethods(); });
  it("opens with name/focus and body lock, closes through cancel then restores opener and scroll", async () => {
    const onClose = vi.fn(), opener = document.createElement("button");
    document.body.append(opener); opener.focus(); const overflow = document.body.style.overflow;
    const { unmount } = render(<ClientModal {...props} action={vi.fn()} onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "Nuevo cliente" })).toBeVisible();
    expect(screen.getByLabelText("Nombre *")).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-closing", "true");
    expect(screen.getByRole("button", { name: "Crear cliente" })).toBeDisabled();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    unmount(); expect(opener).toHaveFocus(); expect(document.body.style.overflow).toBe(overflow); opener.remove();
  });
  it("does not dismiss a pending or ambiguous save, preserves exact request and closes only after confirmed retry", async () => {
    let finish!: (state: SaveState) => void;
    const action = vi.fn().mockImplementationOnce(() => new Promise<SaveState>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce({ status: "success", client: confirmed });
    const onClose = vi.fn(), onSaved = vi.fn();
    render(<ClientModal {...props} action={action} onClose={onClose} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText("Nombre *"), "Intención pendiente");
    await userEvent.click(screen.getByRole("button", { name: "Crear cliente" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("button", { name: "Cerrar formulario" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await act(async () => finish({ status: "error", retry: true, message: "Sin confirmar" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("dialog")).not.toHaveAttribute("data-closing");
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Intención pendiente");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledExactlyOnceWith(confirmed));
    expect(action.mock.calls[0][1].get("request_id")).toBe(action.mock.calls[1][1].get("request_id"));
    expect(action.mock.calls[0][1].get("name")).toBe(action.mock.calls[1][1].get("name"));
    expect(onClose).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
  });
  it("shows conflicts in place and resumes the confirmed version with a new intent", async () => {
    const action = vi.fn().mockResolvedValueOnce({ status: "conflict", confirmed }).mockResolvedValueOnce({ status: "success", client: confirmed });
    const onSaved = vi.fn(); render(<ClientModal {...props} client={{ ...confirmed, version: 1 }} action={action} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("se actualizó");
    expect(screen.getByRole("dialog", { name: "Editar cliente" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar formulario" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Volver a editar" }));
    expect(screen.getByLabelText("Nombre *")).toHaveValue(confirmed.name);
    expect(screen.getByLabelText("Nombre *")).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(action.mock.calls[1][1].get("version")).toBe("2");
    expect(action.mock.calls[1][1].get("request_id")).not.toBe(action.mock.calls[0][1].get("request_id"));
  });
  it("direct route modal closes to a normalized return path", async () => {
    render(<ClientModal {...props} returnTo="https://evil.invalid" action={vi.fn()} />);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledExactlyOnceWith("/clientes"));
  });
});
