import { act, render, screen } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import { beforeEach, expect, it } from "vitest";
import { GlobalLoading, useLoadingOperation, usePendingLoading } from "@/components/ui/global-loading";

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
