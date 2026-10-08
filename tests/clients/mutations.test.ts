import { beforeEach, describe, expect, it, vi } from "vitest";
import { performSave } from "@/lib/clients/mutations";
import { form, clientId, requestId, confirmed } from "./fixture";
const rpc = vi.fn();
const latest = vi.fn();
describe("authenticated RPC mutation seam", () => {
  beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: confirmed, error: null }); });
  it("uses create RPC and stable request UUID; optional contact is server default", async () => {
    const result = await performSave({ rpc }, form(), latest);
    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("create_client", { p_request_id: requestId,
      p_payload: { name: "Cliente prueba", company: null, rubro: null, email: null, phone: null, notes: null, meeting_at: null } });
  });
  it("sends expected version and status together through atomic update", async () => {
    await performSave({ rpc }, form({ client_id: clientId, version: "1", status: "Cerrado" }), latest);
    expect(rpc.mock.calls[0][0]).toBe("update_client");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_client_id: clientId, p_expected_version: 1,
      p_request_id: requestId, p_payload: { status: "Cerrado", contact_at: "2026-10-07T15:30:00.000Z" } });
  });
  it("never invokes RPC for invalid name/email/dates", async () => {
    expect((await performSave({ rpc }, form({ name: " " }), latest)).status).toBe("invalid");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("loads confirmed record on version conflict without automatic retry", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "client_version_conflict" }, status: 409 });
    latest.mockResolvedValue(confirmed);
    const result = await performSave({ rpc }, form({ client_id: clientId, version: "1", status: "Contactado" }), latest);
    expect(result).toMatchObject({ status: "conflict", confirmed });
    expect(latest).toHaveBeenCalledWith(clientId); expect(rpc).toHaveBeenCalledOnce();
  });
  it("defensively handles a legacy SQL conflict over HTTP 500; this is not the observed live response", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "client_version_conflict" }, status: 500 });
    latest.mockResolvedValue(confirmed);
    expect(await performSave({ rpc }, form({ client_id: clientId, version: "1", status: "Contactado" }), latest))
      .toMatchObject({ status: "conflict", confirmed });
    expect(latest).toHaveBeenCalledWith(clientId);
    expect(rpc).toHaveBeenCalledOnce();
  });
  it.each(["PT409", "40001"])("keeps an incomplete request %s uncertain instead of presenting a version conflict", async (code) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "incomplete_request" }, status: code === "PT409" ? 409 : 500 });
    expect(await performSave({ rpc }, form({ client_id: clientId, version: "1", status: "Contactado" }), latest))
      .toMatchObject({ status: "error", retry: true });
    expect(latest).not.toHaveBeenCalled();
  });
  it.each([
    { code: "40001", message: "could not serialize access", status: 500 },
    { code: "PT409", message: "another_conflict", status: 409 },
    { code: "PT409", message: "incomplete_request", details: "client_version_conflict", status: 409 },
  ])("does not infer a business version conflict from an unrelated error code/details", async (error) => {
    rpc.mockResolvedValue({ data: null, error, status: error.status });
    expect((await performSave({ rpc }, form({ client_id: clientId, version: "1", status: "Contactado" }), latest)).status).toBe("error");
    expect(latest).not.toHaveBeenCalled();
  });
  it("keeps same UUID and exact payload on ambiguous transport retry", async () => {
    rpc.mockRejectedValueOnce(new Error("network"));
    const input = form();
    const result = await performSave({ rpc }, input, latest);
    expect(result).toMatchObject({ status: "error", retry: true });
    await performSave({ rpc }, input, latest);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
  it.each([{ error: { code: "" }, status: 0 }, { error: { code: "PGRSTX" }, status: 503 }])(
    "recognizes resolved SDK transport/server failure as ambiguous", async (failure) => {
      rpc.mockResolvedValue({ data: null, ...failure });
      expect(await performSave({ rpc }, form(), latest)).toMatchObject({ status: "error", retry: true });
    });
  it.each(["42501", "23514", "23502", "P0002", "22023"])("fails closed for SQL error %s", async (code) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "private internals" } });
    const result = await performSave({ rpc }, form(), latest);
    expect(result.status).toBe("error"); expect(JSON.stringify(result)).not.toContain("private internals");
  });
  it("does not treat malformed RPC response as saved", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    expect((await performSave({ rpc }, form(), latest)).status).toBe("error");
  });
});
