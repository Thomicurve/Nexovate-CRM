import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteClient, moveClient, saveClient } from "@/app/(crm)/clientes/actions";
import NewClientPage from "@/app/(crm)/clientes/nuevo/page";
import EditClientPage from "@/app/(crm)/clientes/[id]/editar/page";
import ClientsPage from "@/app/(crm)/clientes/page";
import { getClient } from "@/lib/clients/server";
import { clientId, requestId, confirmed, form } from "./fixture";

const f = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(),
  single: vi.fn(), order: vi.fn(), range: vi.fn(), is: vi.fn(), redirect: vi.fn(), revalidate: vi.fn(), notFound: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-member", () => ({ requireMember: f.guard }));
vi.mock("next/navigation", () => ({ redirect: f.redirect, notFound: f.notFound, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
describe("client pages, actions and DAL server boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.guard.mockResolvedValue({ client: { rpc: f.rpc, from: f.from }, userId: "synthetic-member" });
    f.from.mockReturnValue({ select: f.select }); f.select.mockReturnValue({ is: f.is }); f.is.mockReturnValue({ eq: f.eq, order: f.order }); f.eq.mockReturnValue({ maybeSingle: f.single });
    f.order.mockReturnValue({ order: f.order, range: f.range }); f.range.mockResolvedValue({ data: [], count: 0, error: null });
    f.single.mockResolvedValue({ data: confirmed, error: null }); f.rpc.mockResolvedValue({ data: confirmed, error: null });
    f.redirect.mockImplementation((path) => { throw new Error(`redirect:${path}`); });
    f.notFound.mockImplementation(() => { throw new Error("not-found"); });
  });
  it("returns actual confirmed success for navigation feedback without URL flags or redirects", async () => {
    await expect(saveClient({ status: "idle" }, form({ return_to: "https://evil.invalid" })))
      .resolves.toEqual({ status: "success", client: confirmed });
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.rpc).toHaveBeenCalledOnce();
    expect(f.revalidate).toHaveBeenCalledWith("/clientes");
    expect(f.redirect).not.toHaveBeenCalled();
  });
  it("guards DAL before returning selected row and validates its schema", async () => {
    expect(await getClient(clientId)).toEqual({ kind: "found", client: confirmed });
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.from).toHaveBeenCalledWith("clients");
    expect(f.eq).toHaveBeenCalledWith("id", clientId);
    expect(f.is).toHaveBeenCalledWith("deleted_at", null);
    f.single.mockResolvedValue({ data: { id: clientId }, error: null });
    expect(await getClient(clientId)).toEqual({ kind: "unavailable" });
  });
  it("guards delete and invalidates clients and dashboard only after a matching receipt", async () => {
    f.rpc.mockResolvedValue({ data: { client_id: clientId, request_id: requestId, version: 3, deleted_at: "2026-10-09T12:00:00Z" }, error: null });
    expect(await deleteClient({ requestId, clientId, version: 2 })).toEqual({ kind: "success" });
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.revalidate.mock.calls).toEqual([["/clientes"], ["/dashboard"]]);
    f.revalidate.mockClear(); f.rpc.mockRejectedValue(new Error("transport"));
    expect(await deleteClient({ requestId, clientId, version: 2 })).toMatchObject({ kind: "error", retry: true });
    expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("guards a status-only move and revalidates only confirmed success without redirect", async () => {
    const intent = { requestId, clientId, version: 2, from: "Contactado", to: "Cerrado" };
    const saved = { ...confirmed, status: "Cerrado", version: 3 }; f.rpc.mockResolvedValue({ data: saved, error: null });
    expect(await moveClient(intent)).toEqual({ kind: "success", client: saved });
    expect(f.guard).toHaveBeenCalledOnce(); expect(f.rpc).toHaveBeenCalledOnce();
    expect(f.guard.mock.invocationCallOrder[0]).toBeLessThan(f.rpc.mock.invocationCallOrder[0]);
    expect(f.revalidate).toHaveBeenCalledWith("/clientes"); expect(f.redirect).not.toHaveBeenCalled();
    f.revalidate.mockClear();
    expect(await moveClient({})).toEqual({ kind: "invalid" }); expect(f.guard).toHaveBeenCalledTimes(2);
    expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("recovers a move conflict through guarded DAL without redirect, revalidation or another write", async () => {
    f.rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "client_version_conflict" }, status: 409 });
    expect(await moveClient({ requestId, clientId, version: 1, from: "Interesado", to: "Cerrado" }))
      .toEqual({ kind: "conflict", confirmed });
    expect(f.guard).toHaveBeenCalledTimes(2); expect(f.rpc).toHaveBeenCalledOnce();
    expect(f.eq).toHaveBeenCalledWith("id", clientId);
    expect(f.revalidate).not.toHaveBeenCalled(); expect(f.redirect).not.toHaveBeenCalled();
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
    await expect(moveClient({})).rejects.toThrow(`blocked:${kind}`);
    await expect(getClient(clientId)).rejects.toThrow(`blocked:${kind}`);
    await expect(NewClientPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(`blocked:${kind}`);
    await expect(EditClientPage({ params: Promise.resolve({ id: clientId }), searchParams: Promise.resolve({}) })).rejects.toThrow(`blocked:${kind}`);
    await expect(ClientsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(`blocked:${kind}`);
    expect(f.from).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });
});
