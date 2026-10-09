import type { ReactNode } from "react";
import { WithLoading } from "../ui/loading-test-support";
import { act, render as renderUi, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import type { LoginState } from "@/lib/auth/login";

const render = (ui: ReactNode) => renderUi(ui, { wrapper: WithLoading });

describe("approved accessible login states", () => {
  it("labels inputs, preserves password privacy and supports keyboard submission", async () => {
    const action = vi.fn().mockResolvedValue({ status: "error", message: "Error de prueba" });
    render(<LoginForm action={action} />);
    const user = userEvent.setup();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    await user.type(screen.getByLabelText("Email"), "member@example.invalid");
    await user.type(screen.getByLabelText("Contraseña"), "synthetic");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Error de prueba");
    expect(action.mock.calls[0][1].get("password")).toBe("synthetic");
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
  });
  it("prevents duplicate submissions and announces pending progress", async () => {
    let finish!: (state: LoginState) => void;
    const action = vi.fn(() => new Promise<LoginState>((resolve) => { finish = resolve; }));
    render(<LoginForm action={action} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "member@example.invalid");
    await user.type(screen.getByLabelText("Contraseña"), "synthetic");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(screen.getByRole("button", { name: "Ingresando…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    expect(action).toHaveBeenCalledOnce();
    await act(async () => finish({ status: "error", message: "Reintentá" }));
  });
  it("shows the exact expired-session message", () => {
    render(<LoginForm action={vi.fn()} expired />);
    expect(screen.getByRole("status")).toHaveTextContent("Tu sesión finalizó. Ingresá para continuar.");
  });
});
