import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import PageError from "@/app/error";
import PageNotFound from "@/app/not-found";
vi.mock("@/components/ui/motion", () => ({ usePanelMotion() {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
it("error recovery retries only the page load explicitly and does not disclose provider errors", () => {
  const reset = vi.fn();
  render(<PageError error={new Error("private provider connection and stack")} reset={reset} />);
  expect(reset).not.toHaveBeenCalled();
  expect(screen.queryByText(/private provider/)).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("revisá el resultado en Clientes antes de intentarlo otra vez");
  expect(screen.getByRole("link", { name: "Volver a clientes" })).toHaveAttribute("href", "/clientes");
  fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" })); expect(reset).toHaveBeenCalledTimes(1);
});
it("not found guides to the safe client route without an invented retry", () => {
  render(<PageNotFound />);
  expect(screen.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByRole("link", { name: "Volver a clientes" })).toHaveAttribute("href", "/clientes");
});
