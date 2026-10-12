import { act, render, screen } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GlobalLoading, useLoadingOperation, usePendingLoading } from "@/components/ui/global-loading";
vi.mock("@/components/ui/motion", () => ({ usePanelMotion() {} }));
afterEach(() => vi.useRealTimers());

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); this.focus(); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
function Pending({ active }: { active: boolean }) { usePendingLoading(active); return null; }
it("overlapping operations, cancellation and unmount release only their own loading token", () => {
  const { rerender } = render(<><GlobalLoading /><Pending active /><Pending active /></>);
  expect(screen.getByRole("dialog", { name: "Cargando" })).toBeVisible();
  rerender(<><GlobalLoading /><Pending active={false} /><Pending active /></>);
  expect(screen.getByRole("dialog", { name: "Cargando" })).toBeVisible();
  rerender(<><GlobalLoading /><Pending active={false} /></>);
  expect(screen.queryByRole("dialog", { name: "Cargando" })).toBeNull();
});
it("failure settles loading and restores the original connected focus target", async () => {
  let run!: <T>(operation: () => Promise<T>) => Promise<T>;
  function Operation() { const operation = useLoadingOperation(); useLayoutEffect(() => { run = operation; }); return <button>Origen</button>; }
  render(<><GlobalLoading /><Operation /></>);
  const opener = screen.getByRole("button"); opener.focus();
  let reject!: (reason: Error) => void;
  let result!: Promise<unknown>;
  act(() => { result = run(() => new Promise((_, fail) => { reject = fail; })).catch(() => {}); });
  expect(screen.getByRole("dialog", { name: "Cargando" })).toHaveFocus();
  await act(async () => { reject(new Error("Recoverable")); await result; });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(opener).toHaveFocus();
});
it("unmount releases an unfinished action and late settlement is harmless", async () => {
  let run!: <T>(operation: () => Promise<T>) => Promise<T>, remove!: () => void;
  function Operation() { const operation = useLoadingOperation(); useLayoutEffect(() => { run = operation; }); return null; }
  function Harness() { const [visible, setVisible] = useState(true); useLayoutEffect(() => { remove = () => setVisible(false); }); return <><GlobalLoading />{visible && <Operation />}</>; }
  render(<Harness />);
  let finish!: () => void, result!: Promise<void>;
  act(() => { result = run(() => new Promise<void>((resolve) => { finish = resolve; })); });
  expect(screen.getByRole("dialog")).toBeVisible();
  act(remove); expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => { finish(); await result; });
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("names overlapping owners and preserves write guidance until that owner settles", () => {
  vi.useFakeTimers();
  function Owner({ active, operation }: { active: boolean; operation: "save" | "clients" }) {
    usePendingLoading(active, operation); return null;
  }
  const view = render(<><GlobalLoading /><Owner active operation="save" /><Owner active operation="clients" /></>);
  expect(screen.getByRole("status")).toHaveTextContent("Guardando cliente…");
  expect(screen.getByRole("status")).toHaveTextContent("Consultando clientes…");
  act(() => vi.advanceTimersByTime(8000));
  expect(screen.getByText(/No vuelvas a enviar/)).toBeVisible();
  view.rerender(<><GlobalLoading /><Owner active operation="save" /><Owner active={false} operation="clients" /></>);
  expect(screen.getByRole("status")).not.toHaveTextContent("Consultando clientes…");
  expect(screen.getByRole("status")).toHaveTextContent("Guardando cliente…");
  expect(screen.queryByRole("button")).toBeNull();
  view.unmount(); expect(screen.queryByRole("dialog")).toBeNull();
});
it("long read waits provide guidance without claiming a backend confirmation or offering a write retry", () => {
  vi.useFakeTimers();
  function Owner() { usePendingLoading(true, "metrics"); return null; }
  render(<><GlobalLoading /><Owner /></>);
  expect(screen.getByRole("status")).toHaveTextContent("Consultando métricas…");
  act(() => vi.advanceTimersByTime(8000));
  expect(screen.getByText(/La carga está tardando/)).toBeVisible();
  expect(screen.queryByText(/No vuelvas a enviar/)).toBeNull();
});
