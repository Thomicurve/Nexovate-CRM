import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider, useNotification } from "@/components/ui/notifications";

function Page({ destination = false }: { destination?: boolean }) {
  const notify = useNotification();
  return destination ? <h1>Clientes</h1> : <button onClick={() => notify("Cliente creado", "Nombre confirmado")}>Guardar confirmado</button>;
}

describe("global accessible notification lifecycle", () => {
  afterEach(() => vi.useRealTimers());
  it("survives replacement of the page without stealing focus and closes explicitly", () => {
    const { rerender } = render(<NotificationProvider><Page /></NotificationProvider>);
    const save = screen.getByRole("button", { name: "Guardar confirmado" }); save.focus(); fireEvent.click(save);
    expect(save).toHaveFocus();
    rerender(<NotificationProvider><Page destination /></NotificationProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("Cliente creadoNombre confirmado");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("expires after six active seconds, pauses throughout hover and focus, and resets for a new result", () => {
    vi.useFakeTimers();
    render(<NotificationProvider><Page /></NotificationProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Guardar confirmado" }));
    act(() => vi.advanceTimersByTime(2000));
    const close = screen.getByRole("button", { name: "Cerrar notificación" });
    fireEvent.mouseEnter(close.parentElement!); fireEvent.focus(close);
    act(() => vi.advanceTimersByTime(10000));
    fireEvent.mouseLeave(close.parentElement!);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.blur(close, { relatedTarget: document.body });
    act(() => vi.advanceTimersByTime(3999)); expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar confirmado" }));
    act(() => vi.advanceTimersByTime(5999)); expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1)); expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
