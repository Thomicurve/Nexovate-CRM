import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CrmShell } from "@/components/ui/crm-shell";
import { WithLoading } from "./loading-test-support";

vi.mock("next/navigation", () => ({ usePathname: () => "/clientes/nuevo", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props: object) => <span {...props} /> }));
vi.mock("next/link", () => ({ default: ({ children, onNavigate, ...props }: { children: ReactNode; onNavigate?: unknown }) => {
  void onNavigate; return <a {...props}>{children}</a>;
} }));
vi.mock("@/components/ui/motion", () => ({ usePanelMotion: vi.fn() }));

it("exposes a skip destination and the current route without mixing logout into navigation", async () => {
  render(<WithLoading><CrmShell logout={vi.fn()}><h1>Clientes</h1></CrmShell></WithLoading>);
  const skip = screen.getByRole("link", { name: "Saltar al contenido" });
  expect(skip).toHaveAttribute("href", "#crm-content");
  fireEvent.click(skip);
  expect(screen.getByRole("main")).toHaveFocus();
  expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  expect(screen.getByRole("navigation")).not.toContainElement(screen.getByRole("button", { name: "Cuenta · Socio" }));
});

it("opens the account by keyboard, dismisses it and returns focus without signing out", async () => {
  const logout = vi.fn(), user = userEvent.setup();
  render(<WithLoading><CrmShell logout={logout}><h1>Clientes</h1></CrmShell></WithLoading>);
  const account = screen.getByRole("button", { name: "Cuenta · Socio" });
  account.focus(); await user.keyboard("{ArrowDown}");
  expect(account).toHaveAttribute("aria-expanded", "true");
  const item = screen.getByRole("menuitem", { name: "Cerrar sesión" });
  expect(item).toHaveFocus();
  expect(account).toHaveAttribute("aria-controls", screen.getByRole("menu").id);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull(); expect(account).toHaveFocus();
  await user.click(account); await user.click(screen.getByRole("heading"));
  expect(screen.queryByRole("menu")).toBeNull(); expect(logout).not.toHaveBeenCalled();
  await user.click(account); await user.click(screen.getByRole("menuitem"));
  expect(logout).toHaveBeenCalledOnce();
});

it("keeps logout loading and duplicate guards alive after modal focus closes the account", async () => {
  let finish!: () => void;
  const logout = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })), user = userEvent.setup();
  render(<WithLoading><CrmShell logout={logout}><h1>Clientes</h1></CrmShell></WithLoading>);
  const account = screen.getByRole("button", { name: "Cuenta · Socio" });
  await user.click(account);
  const item = screen.getByRole("menuitem", { name: "Cerrar sesión" });
  await user.click(item);
  expect(logout).toHaveBeenCalledOnce();
  const loading = screen.getByRole("dialog", { name: "Cargando" });
  expect(loading).toBeVisible(); expect(loading).toHaveFocus();
  expect(screen.queryByRole("menu")).toBeNull();
  expect(item.isConnected).toBe(true); expect(item).toBeDisabled();
  fireEvent.click(item); await user.keyboard("{Escape}{Enter}");
  expect(logout).toHaveBeenCalledOnce(); expect(loading).toBeVisible();
  screen.getByRole("main").focus(); expect(loading).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  await act(async () => finish());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(account).toHaveFocus(); expect(item).toBeEnabled();
});
