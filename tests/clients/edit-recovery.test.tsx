import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import EditClientPage from "@/app/(crm)/clientes/[id]/editar/page";
import { safeReturnPath } from "@/lib/clients/model";
vi.mock("@/lib/auth/require-member", () => ({ requireMember: vi.fn() }));
vi.mock("@/components/ui/motion", () => ({ usePanelMotion() {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), notFound: vi.fn() }));
vi.mock("@/lib/clients/server", () => ({ getClient: async () => ({ kind: "unavailable" }) }));
vi.mock("@/app/(crm)/clientes/actions", () => ({ saveClient: vi.fn(), deleteClient: vi.fn() }));
it.each(["/clientes?nombre=Acme&vista=tabla&orden=contacto&direccion=asc", "https://evil.invalid/", "/clientes?extra=ignored"])("failed edit load preserves only safe return context: %s", async (returnTo) => {
  const id = "00000000-0000-4000-8000-000000000001";
  render(await EditClientPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ returnTo }) }));
  const safe = safeReturnPath(returnTo);
  expect(screen.getByRole("link", { name: "Reintentar carga" })).toHaveAttribute("href", `/clientes/${id}/editar?returnTo=${encodeURIComponent(safe)}`);
  expect(screen.getByRole("link", { name: "Volver a clientes" })).toHaveAttribute("href", safe);
});
