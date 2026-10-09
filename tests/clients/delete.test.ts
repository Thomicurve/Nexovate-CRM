import { expect, it, vi } from "vitest";
import { performDelete } from "@/lib/clients/delete";
import { confirmed, requestId } from "./fixture";
const intent = { requestId, clientId: confirmed.id, version: confirmed.version };
it("only confirms a matching server receipt", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { client_id: confirmed.id, request_id: requestId, version: confirmed.version + 1, deleted_at: "2026-10-09T12:00:00Z" }, error: null });
  expect(await performDelete({ rpc }, intent)).toMatchObject({ kind: "success" });
  expect(rpc).toHaveBeenCalledWith("delete_client", { p_request_id: requestId, p_client_id: confirmed.id, p_expected_version: confirmed.version });
  rpc.mockResolvedValue({ data: { client_id: "other" }, error: null });
  expect(await performDelete({ rpc }, intent)).toMatchObject({ kind: "error", retry: true });
});
it("validates before RPC and preserves retry/conflict semantics", async () => {
  const rpc = vi.fn().mockRejectedValue(new TypeError("network"));
  expect(await performDelete({ rpc }, { ...intent, version: 0 })).toMatchObject({ kind: "invalid" });
  expect(rpc).not.toHaveBeenCalled();
  expect(await performDelete({ rpc }, intent)).toMatchObject({ kind: "error", retry: true });
  rpc.mockResolvedValue({ error: { code: "PT409", message: "client_version_conflict" } });
  expect(await performDelete({ rpc }, intent)).toMatchObject({ kind: "conflict" });
  rpc.mockResolvedValue({ error: { code: "42501" }, status: 403 });
  expect(await performDelete({ rpc }, intent)).toMatchObject({ kind: "error", retry: false });
});
