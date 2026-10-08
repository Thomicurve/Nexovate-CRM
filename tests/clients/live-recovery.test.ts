import { describe, expect, it } from "vitest";
import { recoverFixtures, finishLiveRun, type TrackedRequest } from "../e2e/clients-live-recovery";
import { confirmed, clientId, requestId } from "./fixture";
import type { Client } from "../../src/lib/clients/model";

const actor = "33333333-3333-4333-8333-333333333333";
const editId = "44444444-4444-4444-8444-444444444444";
const prefix = "WU006-55555555-5555-4555-8555-555555555555";
const created = { ...confirmed, name: `${prefix}-owner`, version: 1 };
const edited = { ...created, notes: "Confirmed edit", version: 2 };
const create: TrackedRequest = { actor, id: requestId, clientId: null };
const edit: TrackedRequest = { actor, id: editId, clientId };
const ledger = (request: TrackedRequest, response: Client = created) => ({ actor_id: request.actor, request_id: request.id,
  envelope: { operation: request.clientId ? "update" : "create", client_id: request.clientId }, response });
const recover = (requests: TrackedRequest[], rows: unknown[], current: unknown[], existing = new Map()) =>
  recoverFixtures(prefix, requests, existing, async () => rows, async () => current);

describe("live fixture recovery before guarded cleanup", () => {
  it("discovers a committed UI creation even when the URL assertion failed before remembering its ID", async () => {
    expect((await recover([create], [ledger(create)], [created])).get(clientId)).toEqual(created);
  });
  it("recovers the latest committed edit instead of deleting against a stale remembered snapshot", async () => {
    const existing = new Map([[clientId, created]]);
    const recovered = await recover([create, edit], [ledger(edit, edited), ledger(create)], [edited], existing);
    expect(recovered.get(clientId)).toEqual(edited);
    expect(existing.get(clientId)).toEqual(created);
  });
  it("compares full snapshots independent of JSON key order", async () => {
    const reversed = Object.fromEntries(Object.entries(created).reverse());
    expect((await recover([create], [ledger(create)], [reversed])).size).toBe(1);
  });
  it("reports a missing uncertain request as pending rather than proving that nothing was written", async () => {
    await expect(recover([create], [], [])).rejects.toThrow("outcome pending");
    await expect(recover([create, edit], [ledger(create)], [created])).rejects.toThrow("outcome pending");
  });
  it("allows missing ledger only for a positively observed rollback", async () => {
    const rolledBack = { ...edit, rolledBack: true };
    expect((await recover([create, rolledBack], [ledger(create)], [created])).get(clientId)).toEqual(created);
    await expect(recover([create, rolledBack], [ledger(create), ledger(edit, edited)], [edited])).rejects.toThrow("provenance");
  });
  it("refuses foreign actors, request IDs, prefixes, or edit targets", async () => {
    for (const row of [
      { ...ledger(create), actor_id: editId }, { ...ledger(create), request_id: editId },
      ledger(create, { ...created, name: "Another run" }),
      { ...ledger(edit, edited), envelope: { operation: "update", client_id: actor } },
    ]) await expect(recover([create, edit], [row], [created])).rejects.toThrow("provenance");
  });
  it("refuses an outsider's changed snapshot, even if it retains the run prefix", async () => {
    await expect(recover([create], [ledger(create)], [{ ...created, notes: "External edit" }])).rejects.toThrow("snapshot changed");
    await expect(recover([create], [ledger(create)], [])).rejects.toThrow("snapshot changed");
    await expect(recover([], [], [], new Map([[clientId, created]]))).rejects.toThrow("unconfirmed fixture");
  });
});

describe("live fixture finalization", () => {
  it("preserves the primary stage error alongside an uncertain cleanup failure", async () => {
    const primary = new Error("stage conflict"), cleanup = new Error("outcome pending");
    let failure: unknown;
    try { await finishLiveRun(async () => {}, async () => { throw cleanup; }, [], primary); }
    catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([primary, cleanup]);
  });
  it("still recovers/cleans and signs out both accounts after browser close fails", async () => {
    const calls: string[] = [];
    await expect(finishLiveRun(async () => { calls.push("close"); throw new Error("close failed"); },
      async () => { calls.push("cleanup"); }, [async () => { calls.push("owner"); }, async () => { calls.push("partner"); }]))
      .rejects.toThrow("close failed");
    expect(calls).toEqual(["close", "cleanup", "owner", "partner"]);
  });
  it("attempts both sign-outs even when recovery and the first sign-out fail", async () => {
    const calls: string[] = [];
    await expect(finishLiveRun(async () => {}, async () => { throw new Error("outcome pending"); },
      [async () => { calls.push("owner"); throw new Error("signout failed"); }, async () => { calls.push("partner"); }]))
      .rejects.toThrow("outcome pending");
    expect(calls).toEqual(["owner", "partner"]);
  });
});
