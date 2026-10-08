import { isClient, UUID, type Client } from "../../src/lib/clients/model";

export type TrackedRequest = { actor: string; id: string; clientId: string | null; rolledBack?: boolean };
type LedgerRow = { actor_id: string; request_id: string;
  envelope: { operation: string; client_id: string | null }; response: unknown };
// Client snapshots contain only scalar fields; sorting preserves complete JSONB value equality.
const canonical = (row: object) => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));

// Ledger confirmation is required even when an assertion failed before the UI exposed the client ID.
// A missing response is uncertain, unless the test positively observed the operation's rollback.
export async function recoverFixtures(prefix: string, requests: TrackedRequest[], existing: Map<string, Client>,
  loadLedger: () => Promise<unknown[]>, loadCurrent: (ids: string[]) => Promise<unknown[]>) {
  if (!prefix.startsWith("WU006-") || !UUID.test(prefix.slice(6)) || requests.some((row) =>
    !UUID.test(row.actor) || !UUID.test(row.id) || row.clientId !== null && !UUID.test(row.clientId)))
    throw new Error("Recovery provenance invalid; no cleanup");
  const key = (actor: string, id: string) => `${actor}/${id}`;
  const known = new Map(requests.map((row) => [key(row.actor, row.id), row]));
  if (known.size !== requests.length) throw new Error("Recovery provenance duplicated; no cleanup");
  const seen = new Set<string>(), snapshots = new Map<string, Client>();
  for (const raw of await loadLedger()) {
    const row = raw as LedgerRow | null;
    const pair = row && key(row.actor_id, row.request_id), tracked = pair && known.get(pair);
    if (!row || !pair || !tracked || tracked.rolledBack || seen.has(pair) || !row.envelope ||
      row.envelope.operation !== (tracked.clientId === null ? "create" : "update") ||
      row.envelope.client_id !== tracked.clientId || !isClient(row.response) ||
      !row.response.name.startsWith(`${prefix}-`) || tracked.clientId !== null && row.response.id !== tracked.clientId)
      throw new Error("Recovery provenance mismatch; no cleanup");
    seen.add(pair);
    const prior = snapshots.get(row.response.id);
    if (prior?.version === row.response.version && canonical(prior) !== canonical(row.response))
      throw new Error("Recovery provenance inconsistent; no cleanup");
    if (!prior || prior.version < row.response.version) snapshots.set(row.response.id, row.response);
  }
  for (const row of requests) if (!row.rolledBack && !seen.has(key(row.actor, row.id)))
    throw new Error(`Fixture outcome pending for request ${row.id}; no cleanup`);
  if (snapshots.size > 2 || [...existing.keys()].some((id) => !snapshots.has(id)))
    throw new Error("Recovery has an unconfirmed fixture; no cleanup");
  const current = await loadCurrent([...snapshots.keys()]);
  const ids = new Set<string>();
  for (const row of current) {
    if (!isClient(row) || ids.has(row.id) || !snapshots.has(row.id) || canonical(row) !== canonical(snapshots.get(row.id)!))
      throw new Error("Fixture snapshot changed; no cleanup");
    ids.add(row.id);
  }
  if (ids.size !== snapshots.size) throw new Error("Fixture snapshot changed; no cleanup");
  return snapshots;
}

export async function finishLiveRun(close: () => Promise<unknown>, cleanup: () => Promise<unknown>,
  signOut: (() => Promise<unknown>)[], primaryFailure?: unknown) {
  let failure: unknown;
  try { await close(); } catch (error) { failure = error; }
  try { await cleanup(); } catch (error) { failure = error; }
  const signedOut = await Promise.allSettled(signOut.map((run) => Promise.resolve().then(run)));
  if (signedOut.some((result) => result.status === "rejected") && failure === undefined)
    failure = new Error("Fixture sign-out unconfirmed");
  if (failure !== undefined && primaryFailure !== undefined)
    throw new AggregateError([primaryFailure, failure], "Live fixture failure; cleanup/session finalization failed");
  if (failure !== undefined) throw failure;
  if (primaryFailure !== undefined) throw primaryFailure;
}
