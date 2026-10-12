import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClientForm } from "@/components/clients/client-form";
import { NotificationProvider } from "@/components/ui/notifications";
import { WithLoading } from "../ui/loading-test-support";
import { confirmed, requestId } from "./fixture";
import type { SaveState } from "@/lib/clients/model";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
it.each([true, false])("guards dirty delete-conflict exit before unlocking, inline=%s", async (inline) => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const onCancel = vi.fn(), onLockChange = vi.fn(), remove = vi.fn().mockResolvedValue({ kind: "conflict" });
  render(<NotificationProvider><WithLoading><ClientForm client={confirmed} requestId={requestId} initialContact="" returnTo="/clientes?nombre=Confirmado&vista=tabla"
    action={vi.fn()} deleteAction={remove} onCancel={inline ? onCancel : undefined} onLockChange={onLockChange} /></WithLoading></NotificationProvider>);
  fireEvent.change(screen.getByLabelText("Nombre *"), { target: { value: "Borrador conservado" } });
  fireEvent.click(screen.getByRole("button", { name: "Borrar con confirmación" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar borrado" }));
  const exit = await screen.findByRole("button", { name: "Volver a Clientes" });
  exit.focus(); fireEvent.click(exit);
  expect(onCancel).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
  expect(onLockChange).not.toHaveBeenCalledWith(false);
  expect(screen.getByText(/Tu borrador se conserva con los campos bloqueados/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Conservar borrador" }));
  expect(screen.getByLabelText("Nombre *")).toHaveValue("Borrador conservado");
  expect(screen.getByLabelText("Nombre *")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: /Reintentar borrado|Mantener para borrar|Borrar con confirmación/ })).toBeNull();
  await waitFor(() => expect(exit).toHaveFocus());
  expect(onLockChange).not.toHaveBeenCalledWith(false);
  fireEvent.click(exit); fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
  if (inline) expect(onCancel).toHaveBeenCalledOnce();
  else expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/clientes?nombre=Confirmado&vista=tabla");
  expect(onLockChange).toHaveBeenCalledWith(false); expect(remove).toHaveBeenCalledOnce();
});
it.each([true, false])("exits a clean terminal delete conflict directly, inline=%s", async (inline) => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const onCancel = vi.fn(), remove = vi.fn().mockResolvedValue({ kind: "conflict" });
  render(<NotificationProvider><WithLoading><ClientForm client={confirmed} requestId={requestId} initialContact="" returnTo="/clientes"
    action={vi.fn()} deleteAction={remove} onCancel={inline ? onCancel : undefined} /></WithLoading></NotificationProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Borrar con confirmación" })); fireEvent.click(screen.getByRole("button", { name: "Confirmar borrado" }));
  fireEvent.click(await screen.findByRole("button", { name: "Volver a Clientes" }));
  expect(screen.queryByRole("button", { name: "Descartar" })).toBeNull();
  if (inline) expect(onCancel).toHaveBeenCalledOnce(); else expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/clientes");
  expect(remove).toHaveBeenCalledOnce();
});
it("offers ordinary keyboard confirmation using the same pending delete guard", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
  let settle!: (result: { kind: "success" }) => void;
  const remove = vi.fn(() => new Promise<{ kind: "success" }>((resolve) => { settle = resolve; }));
  render(<NotificationProvider><WithLoading><ClientForm client={confirmed} requestId={requestId} initialContact="" returnTo="/clientes"
    action={vi.fn()} deleteAction={remove} onDeleted={vi.fn()} onCancel={vi.fn()} /></WithLoading></NotificationProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Borrar con confirmación" }));
  expect(screen.getByRole("dialog", { name: `Borrar ${confirmed.name}` })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Seguir editando" })); expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Borrar con confirmación" }));
  const confirm = screen.getByRole("button", { name: "Confirmar borrado" });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(remove).toHaveBeenCalledOnce();
  expect(screen.getByRole("heading", { name: "Eliminando cliente…" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  await act(async () => settle({ kind: "success" }));
});
it("requires the hold, freezes uncertain deletion and retries identical intent without premature success", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.useFakeTimers();
  const remove = vi.fn().mockResolvedValueOnce({ kind: "error", retry: true, message: "Sin confirmar" }).mockResolvedValueOnce({ kind: "success" });
  const onDeleted = vi.fn();
  render(<NotificationProvider><WithLoading><ClientForm client={confirmed} requestId={requestId} initialContact="" returnTo="/clientes"
    action={vi.fn()} deleteAction={remove} onDeleted={onDeleted} onCancel={vi.fn()} /></WithLoading></NotificationProvider>);
  const hold = screen.getByRole("button", { name: "Mantener para borrar" });
  fireEvent.keyDown(hold, { key: " " });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  fireEvent.keyUp(hold, { key: " " });
  expect(remove).not.toHaveBeenCalled();
  fireEvent.keyDown(hold, { key: "Enter" });
  await act(() => vi.advanceTimersByTimeAsync(2200));
  expect(remove).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  expect(onDeleted).not.toHaveBeenCalled();
  expect(screen.queryByText("Cliente eliminado")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar borrado" }));
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(remove.mock.calls[0][0]).toEqual(remove.mock.calls[1][0]);
  expect(onDeleted).toHaveBeenCalledOnce();
  expect(screen.getByRole("status")).toHaveTextContent("Cliente eliminado");
  vi.useRealTimers(); vi.unstubAllGlobals();
});
it.each(["pending", "uncertain", "success", "closing"])("blocks an earlier delete retry while save is %s", async (guard) => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.useFakeTimers();
  const remove = vi.fn().mockResolvedValue({ kind: "error", retry: false, message: "Borrado rechazado" });
  let settle!: (result: SaveState) => void;
  const save = vi.fn(() => new Promise<SaveState>((resolve) => { settle = resolve; }));
  const form = (closing = false) => <NotificationProvider><WithLoading><ClientForm client={confirmed} requestId={requestId} initialContact="" returnTo="/clientes"
    action={save} deleteAction={remove} onSuccess={vi.fn()} onCancel={vi.fn()} closing={closing} /></WithLoading></NotificationProvider>;
  const view = render(form());
  fireEvent.keyDown(screen.getByRole("button", { name: "Mantener para borrar" }), { key: "Enter" });
  await act(() => vi.advanceTimersByTimeAsync(2200));
  expect(remove).toHaveBeenCalledOnce();
  if (guard === "closing") view.rerender(form(true));
  else {
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await act(() => vi.advanceTimersByTimeAsync(1));
    if (guard !== "pending") await act(async () => settle(guard === "success" ? { status: "success", client: confirmed } :
      { status: "error", retry: true, message: "Guardado incierto" }));
  }
  const retry = screen.getByRole("button", { name: "Reintentar borrado" });
  expect(retry).toBeDisabled();
  fireEvent.click(retry);
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(remove).toHaveBeenCalledOnce();
  if (guard === "pending") await act(async () => settle({ status: "error", retry: false, message: "Guardado rechazado" }));
});

vi.mock("@/components/ui/motion", () => ({ usePanelMotion: vi.fn() }));
