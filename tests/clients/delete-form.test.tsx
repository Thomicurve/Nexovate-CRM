import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClientForm } from "@/components/clients/client-form";
import { NotificationProvider } from "@/components/ui/notifications";
import { WithLoading } from "../ui/loading-test-support";
import { confirmed, requestId } from "./fixture";
import type { SaveState } from "@/lib/clients/model";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
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
