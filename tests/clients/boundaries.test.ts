import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveClient } from "@/app/(crm)/clientes/actions";
import NewClientPage from "@/app/(crm)/clientes/nuevo/page";
import EditClientPage from "@/app/(crm)/clientes/[id]/editar/page";
import ClientsPage from "@/app/(crm)/clientes/page";
import { getClient } from "@/lib/clients/server";
import { clientId, confirmed, form } from "./fixture";

const f = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(),
  single: vi.fn(), order: vi.fn(), range: vi.fn(), redirect: vi.fn(), revalidate: vi.fn(), notFound: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-member", () => ({ requireMember: f.guard }));
vi.mock("next/navigation", () => ({ redirect: f.redirect, notFound: f.notFound }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
describe("client pages, actions and DAL server boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.guard.mockResolvedValue({ client: { rpc: f.rpc, from: f.from }, userId: "synthetic-member" });
    f.from.mockReturnValue({ select: f.select }); f.select.mockReturnValue({ eq: f.eq, order: f.order }); f.eq.mockReturnValue({ maybeSingle: f.single });
    f.order.mockReturnValue({ order: f.order, range: f.range }); f.range.mockResolvedValue({ data: [], count: 0, error: null });
    f.single.mockResolvedValue({ data: confirmed, error: null }); f.rpc.mockResolvedValue({ data: confirmed, error: null });
    f.redirect.mockImplementation((path) => { throw new Error(`redirect:${path}`); });
    f.notFound.mockImplementation(() => { throw new Error("not-found"); });
  });
  it("guards an action independently and redirects only after confirmed RPC success", async () => {
    await expect(saveClient({ status: "idle" }, form({ return_to: "https://evil.invalid" }))).rejects.toThrow(
      `redirect:/clientes/${clientId}/editar?guardado=1&returnTo=%2Fclientes`);
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.rpc).toHaveBeenCalledOnce();
    expect(f.revalidate).toHaveBeenCalledWith("/clientes");
  });
  it("guards DAL before returning selected row and validates its schema", async () => {
    expect(await getClient(clientId)).toEqual({ kind: "found", client: confirmed });
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.from).toHaveBeenCalledWith("clients");
    expect(f.eq).toHaveBeenCalledWith("id", clientId);
    f.single.mockResolvedValue({ data: { id: clientId }, error: null });
    expect(await getClient(clientId)).toEqual({ kind: "unavailable" });
  });
  it("distinguishes missing row from query/transport failures", async () => {
    f.single.mockResolvedValueOnce({ data: null, error: null }); expect(await getClient(clientId)).toEqual({ kind: "missing" });
    f.single.mockResolvedValueOnce({ data: null, error: { message: "secret internals" } });
    expect(await getClient(clientId)).toEqual({ kind: "unavailable" });
    f.single.mockRejectedValueOnce(new Error("transport")); expect(await getClient(clientId)).toEqual({ kind: "unavailable" });
  });
  it("every page checks membership independently; edit also invokes guarded DAL", async () => {
    await ClientsPage({ searchParams: Promise.resolve({}) }); expect(f.guard).toHaveBeenCalledTimes(2);
    await NewClientPage({ searchParams: Promise.resolve({}) }); expect(f.guard).toHaveBeenCalledTimes(3);
    await EditClientPage({ params: Promise.resolve({ id: clientId }), searchParams: Promise.resolve({}) });
    expect(f.guard).toHaveBeenCalledTimes(5);
  });
  it.each(["anonymous", "denied", "unavailable"])("never accesses data when access is %s", async (kind) => {
    f.guard.mockRejectedValue(new Error(`blocked:${kind}`));
    await expect(saveClient({ status: "idle" }, form())).rejects.toThrow(`blocked:${kind}`);
    await expect(getClient(clientId)).rejects.toThrow(`blocked:${kind}`);
    await expect(NewClientPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(`blocked:${kind}`);
    await expect(EditClientPage({ params: Promise.resolve({ id: clientId }), searchParams: Promise.resolve({}) })).rejects.toThrow(`blocked:${kind}`);
    await expect(ClientsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(`blocked:${kind}`);
    expect(f.from).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });
});
