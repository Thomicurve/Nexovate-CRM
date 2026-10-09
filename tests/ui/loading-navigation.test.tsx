import { act, fireEvent, render, screen } from "@testing-library/react";
import { useActionState, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { FormLoading } from "@/components/ui/global-loading";
import { LoadingLink, useLoadingFormNavigation } from "@/components/ui/loading-navigation";
import { WithLoading } from "./loading-test-support";
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("next/link", () => ({ default: ({ onNavigate, children, ...props }: { onNavigate: (event: { preventDefault: () => void }) => void; children: ReactNode }) =>
  <a {...props} href="/clientes" onClick={(event) => { event.preventDefault(); if (!event.ctrlKey) onNavigate({ preventDefault() {} }); }}>{children}</a> }));
it("navigation preserves query, hash and scroll and clears loading after completion", async () => {
  let finish!: () => void;
  navigation.push.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  render(<WithLoading><LoadingLink href={{ pathname: "/clientes", query: { estado: ["Contactado", "Cerrado"], pagina: 2 }, hash: "list" }} scroll={false}>Clientes</LoadingLink></WithLoading>);
  fireEvent.click(screen.getByRole("link"));
  expect(navigation.push).toHaveBeenLastCalledWith("/clientes?estado=Contactado&estado=Cerrado&pagina=2#list", { scroll: false });
  expect(screen.getByRole("dialog", { name: "Cargando" })).toBeVisible();
  await act(async () => finish()); expect(screen.queryByRole("dialog")).toBeNull();
});
it("cancelled and modified link navigation creates no operation", () => {
  navigation.push.mockClear();
  render(<WithLoading><LoadingLink href="/clientes" onNavigate={(event) => event.preventDefault()}>Clientes</LoadingLink></WithLoading>);
  fireEvent.click(screen.getByRole("link")); fireEvent.click(screen.getByRole("link"), { ctrlKey: true });
  expect(navigation.push).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).toBeNull();
});
it("GET filters keep repeated fields and settle a cancelled transition", async () => {
  let finish!: () => void;
  navigation.push.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  function Filters() { const navigate = useLoadingFormNavigation(); return <form action="/clientes" onSubmit={navigate}>
    <input name="estado" value="Contactado" readOnly /><input name="estado" value="Cerrado" readOnly /><button>Aplicar</button></form>; }
  const { unmount } = render(<WithLoading><Filters /></WithLoading>);
  fireEvent.submit(screen.getByRole("button").closest("form")!);
  expect(navigation.push).toHaveBeenLastCalledWith("/clientes?estado=Contactado&estado=Cerrado");
  expect(screen.getByRole("dialog")).toBeVisible(); unmount();
  await act(async () => finish()); expect(screen.queryByRole("dialog")).toBeNull();
});
it("server form pending (logout) releases loading after recoverable completion", async () => {
  let finish!: () => void;
  function Logout() { const [, submit] = useActionState(async () => { await new Promise<void>((resolve) => { finish = resolve; }); return "error"; }, "idle");
    return <form action={submit}><FormLoading /><button>Cerrar sesión</button></form>; }
  render(<WithLoading><Logout /></WithLoading>);
  fireEvent.submit(screen.getByRole("button").closest("form")!);
  expect(screen.getByRole("dialog")).toBeVisible(); await act(async () => finish());
  expect(screen.queryByRole("dialog")).toBeNull();
});
