import { beforeEach, describe, expect, it, vi } from "vitest";
import { beginMove, finishMove, performMove, retryMove, type BoardMove, type MoveIntent } from "@/lib/clients/moves";
import { STATUSES } from "@/lib/clients/model";
import { clientId, requestId, confirmed } from "./fixture";

const intent: MoveIntent = { requestId, clientId, version: 2, from: "Contactado", to: "Cerrado" };
const saved = { ...confirmed, status: "Cerrado" as const, version: 3 };
const rpc = vi.fn(), latest = vi.fn();
const initial = (): BoardMove => ({ rows: [confirmed], intent: null, original: null, pending: false, result: null });
describe("status-only moves and stable intent", () => {
  beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: saved, error: null }); });
  it("sends only target status with expected version, preserving precise dates and optional fields", async () => {
    expect(await performMove({ rpc }, intent, latest)).toEqual({ kind: "success", client: saved });
    expect(rpc).toHaveBeenCalledWith("update_client", { p_request_id: requestId, p_client_id: clientId,
      p_expected_version: 2, p_payload: { status: "Cerrado" } });
    expect(confirmed.contact_at).toBe("2026-10-07T15:30:42.123Z");
    expect(latest).not.toHaveBeenCalled();
  });
  it.each(STATUSES)("accepts exactly the configured state %s", async (to) => {
    rpc.mockResolvedValue({ data: { ...saved, status: to }, error: null });
    const result = await performMove({ rpc }, { ...intent, to }, latest);
    expect(result.kind).toBe(to === intent.from ? "noop" : "success");
    expect(rpc).toHaveBeenCalledTimes(to === intent.from ? 0 : 1);
  });
  it.each([null, {}, { ...intent, requestId: "bad" }, { ...intent, clientId: "bad" },
    { ...intent, version: 0 }, { ...intent, version: 1.5 }, { ...intent, version: Number.MAX_SAFE_INTEGER },
    { ...intent, from: "Inventado" }, { ...intent, to: "Inventado" }, { ...intent, extra: "field" }])(
    "rejects forged or incomplete intent before RPC", async (input) => {
      expect(await performMove({ rpc }, input, latest)).toEqual({ kind: "invalid" });
      expect(rpc).not.toHaveBeenCalled();
    });
  it("loads the confirmed record on exact business conflict without retrying or overwriting", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "client_version_conflict" }, status: 409 });
    const partner = { ...saved, status: "Interesado" as const }; latest.mockResolvedValue(partner);
    expect(await performMove({ rpc }, intent, latest)).toEqual({ kind: "conflict", confirmed: partner });
    expect(latest).toHaveBeenCalledWith(clientId); expect(rpc).toHaveBeenCalledOnce();
  });
  it.each([null, confirmed, { ...saved, id: requestId }])("does not invent a confirmed snapshot", async (row) => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "client_version_conflict" }, status: 409 });
    latest.mockResolvedValue(row);
    expect(await performMove({ rpc }, intent, latest)).toMatchObject({ kind: "error", retry: true });
  });
  it("keeps transport and read failures uncertain without throwing or leaking details", async () => {
    rpc.mockRejectedValueOnce(new Error("private network detail"));
    expect(await performMove({ rpc }, intent, latest)).toMatchObject({ kind: "error", retry: true });
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "client_version_conflict" }, status: 409 });
    latest.mockRejectedValueOnce(new Error("private read detail"));
    expect(await performMove({ rpc }, intent, latest)).toMatchObject({ kind: "error", retry: true });
  });
  it.each([{ code: "PT409", message: "incomplete_request", status: 409 },
    { code: "40001", message: "could not serialize access", status: 500 },
    { code: "", message: "transport", status: 0 }, { code: "PGRSTX", message: "failure", status: 503 }])(
    "retains the exact intent on ambiguous errors", async ({ status, ...error }) => {
      rpc.mockResolvedValueOnce({ data: null, error, status });
      expect(await performMove({ rpc }, intent, latest)).toMatchObject({ kind: "error", retry: true });
      await performMove({ rpc }, intent, latest);
      expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]); expect(latest).not.toHaveBeenCalled();
    });
  it.each(["42501", "23514", "P0002", "22023", "PT409"])("restores the original after definitive error %s", async (code) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "private detail" }, status: 400 });
    const result = await performMove({ rpc }, intent, latest);
    expect(result).toMatchObject({ kind: "error", retry: false });
    expect(JSON.stringify(result)).not.toContain("private detail"); expect(latest).not.toHaveBeenCalled();
  });
  it.each([{}, confirmed, { ...saved, id: requestId }, { ...saved, version: 4 }, { ...saved, status: "Interesado" }])(
    "does not confirm an unrelated or malformed RPC response", async (data) => {
      rpc.mockResolvedValue({ data, error: null });
      expect(await performMove({ rpc }, intent, latest)).toMatchObject({ kind: "error", retry: true });
    });
});

describe("one pending board intent, rollback and recovery", () => {
  it.each([null, "Contactado", "Outside", "Inventado"])("cancellation/same column/outside (%s) creates no intent", (target) => {
    const board = initial(); expect(beginMove(board, clientId, target, requestId)).toBe(board);
  });
  it("captures one immutable intention and blocks another while pending", () => {
    const board = initial(), moving = beginMove(board, clientId, "Cerrado", requestId);
    expect(moving).toMatchObject({ intent, original: confirmed, pending: true });
    expect(moving.rows[0].status).toBe("Cerrado"); expect(board.rows[0]).toBe(confirmed);
    expect(Object.isFrozen(moving.intent)).toBe(true);
    expect(beginMove(moving, clientId, "Interesado", requestId)).toBe(moving);
  });
  it("confirms the returned snapshot without mutating the source array", () => {
    const moving = beginMove(initial(), clientId, "Cerrado", requestId);
    const board = finishMove(moving, { kind: "success", client: saved });
    expect(board).toMatchObject({ rows: [saved], pending: false, intent: null, original: null });
    expect(moving.rows[0].version).toBe(2);
  });
  it("rolls back ambiguity and retries the same UUID/version/target, blocking fresh moves", () => {
    const moving = beginMove(initial(), clientId, "Cerrado", requestId);
    const failed = finishMove(moving, { kind: "error", retry: true, message: "Reintentar" });
    expect(failed).toMatchObject({ rows: [confirmed], pending: false, intent, original: confirmed });
    expect(beginMove(failed, clientId, "Interesado", requestId)).toBe(failed);
    const retried = retryMove(failed);
    expect(retried.pending).toBe(true); expect(retried.intent).toBe(failed.intent);
    expect(retried.rows[0].status).toBe("Cerrado"); expect(retryMove(retried)).toBe(retried);
  });
  it("definitive failures rollback; confirmed conflict replaces stale card without retrying", () => {
    const moving = beginMove(initial(), clientId, "Cerrado", requestId);
    const failed = finishMove(moving, { kind: "error", retry: false, message: "Reintentá" });
    expect(failed).toMatchObject({ rows: [confirmed], pending: false, intent: null });
    expect(retryMove(failed)).toBe(failed);
    const partner = { ...saved, status: "Interesado" as const };
    const conflicted = finishMove(moving, { kind: "conflict", confirmed: partner });
    expect(conflicted).toMatchObject({ rows: [partner], pending: false, intent: null });
    expect(retryMove(conflicted)).toBe(conflicted);
  });
});
