import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider, useNotification } from "@/components/ui/notifications";
import { usePendingLoading } from "@/components/ui/global-loading";
vi.mock("@/components/ui/motion", () => ({ usePanelMotion() {} }));

function Page({ destination = false }: { destination?: boolean }) {
  const notify = useNotification();
  return destination ? <h1>Clientes</h1> : <button onClick={() => notify("Cliente creado", "Nombre confirmado")}>Guardar confirmado</button>;
}
function Loading({ active }: { active: boolean }) { usePendingLoading(active, "clients"); return null; }

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
  it("defers the announcement and all six usable seconds until a long refresh releases loading", () => {
    vi.useFakeTimers();
    const tree = (active: boolean) => <NotificationProvider><Page /><Loading active={active} /></NotificationProvider>;
    const view = render(tree(true));
    fireEvent.click(screen.getByRole("button", { name: "Guardar confirmado" }));
    expect(screen.queryByRole("status")).toBeNull();
    act(() => vi.advanceTimersByTime(9000));
    view.rerender(tree(false));
    expect(screen.getByRole("status")).toHaveTextContent("Cliente creadoNombre confirmado");
    act(() => vi.advanceTimersByTime(2000));
    const close = screen.getByRole("button", { name: "Cerrar notificación" });
    fireEvent.mouseEnter(close.parentElement!); fireEvent.focus(close);
    act(() => vi.advanceTimersByTime(9000)); fireEvent.mouseLeave(close.parentElement!);
    act(() => vi.advanceTimersByTime(9000)); expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.blur(close, { relatedTarget: document.body });
    act(() => vi.advanceTimersByTime(3999)); expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1)); expect(screen.queryByRole("status")).toBeNull();
  });
  it("preserves partially used time and clears hover and focus when loading hides the surface", () => {
    vi.useFakeTimers();
    const tree = (active: boolean) => <NotificationProvider><Page /><Loading active={active} /></NotificationProvider>;
    const view = render(tree(false));
    const save = screen.getByRole("button", { name: "Guardar confirmado" });
    fireEvent.click(save); act(() => vi.advanceTimersByTime(2000));
    const close = screen.getByRole("button", { name: "Cerrar notificación" });
    fireEvent.mouseEnter(close.parentElement!); act(() => close.focus());
    view.rerender(tree(true)); expect(screen.queryByRole("status")).toBeNull();
    act(() => vi.advanceTimersByTime(9000)); view.rerender(tree(false));
    expect(screen.getByRole("button", { name: "Cerrar notificación" })).not.toHaveFocus();
    act(() => vi.advanceTimersByTime(3999)); expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1)); expect(screen.queryByRole("status")).toBeNull();
  });
});
