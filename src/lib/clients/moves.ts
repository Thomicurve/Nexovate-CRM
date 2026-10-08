import { isClient, STATUSES, UUID, type Client, type ClientStatus } from "./model";

export type MoveIntent = Readonly<{ requestId: string; clientId: string; version: number;
  from: ClientStatus; to: ClientStatus }>;
export type MoveResult = { kind: "success"; client: Client } | { kind: "conflict"; confirmed: Client } |
  { kind: "noop" | "invalid" } | { kind: "error"; retry: boolean; message: string };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
  data: unknown; error: { code?: string; message?: string } | null; status?: number }> };
export type BoardMove = { rows: Client[]; intent: MoveIntent | null; original: Client | null;
  pending: boolean; result: MoveResult | null };

function isIntent(value: unknown): value is MoveIntent {
  if (!value || typeof value !== "object") return false;
  const input = value as MoveIntent;
  return Object.keys(input).length === 5 && typeof input.requestId === "string" && UUID.test(input.requestId) &&
    typeof input.clientId === "string" && UUID.test(input.clientId) && Number.isSafeInteger(input.version) &&
    input.version > 0 && input.version < Number.MAX_SAFE_INTEGER && STATUSES.includes(input.from) && STATUSES.includes(input.to);
}
export function beginMove(board: BoardMove, id: string, target: string | null, requestId: string): BoardMove {
  if (board.intent || board.pending) return board;
  const row = board.rows.find((client) => client.id === id);
  if (!row || row.status === target) return board;
  const intent = { requestId, clientId: id, version: row.version, from: row.status, to: target };
  if (!isIntent(intent)) return board;
  return { rows: board.rows.map((client) => client.id === id ? { ...client, status: intent.to } : client),
    intent: Object.freeze(intent), original: row, pending: true, result: null };
}
export function finishMove(board: BoardMove, result: MoveResult): BoardMove {
  if (!board.pending || !board.intent || !board.original) return board;
  const intent = board.intent;
  const row = result.kind === "success" ? result.client : result.kind === "conflict" ? result.confirmed : board.original;
  const uncertain = result.kind === "error" && result.retry;
  return { rows: board.rows.map((client) => client.id === intent.clientId ? row : client),
    pending: false, result, intent: uncertain ? intent : null, original: uncertain ? board.original : null };
}
export function retryMove(board: BoardMove): BoardMove {
  if (board.pending || !board.intent || board.result?.kind !== "error" || !board.result.retry) return board;
  const intent = board.intent;
  return { ...board, pending: true, result: null,
    rows: board.rows.map((client) => client.id === intent.clientId ? { ...client, status: intent.to } : client) };
}

const uncertain = (): MoveResult => ({ kind: "error", retry: true,
  message: "No podemos confirmar el cambio. Reintentá el mismo movimiento antes de continuar." });
export async function performMove(client: RpcClient, intent: unknown,
  loadLatest: (id: string) => Promise<Client | null>): Promise<MoveResult> {
  if (!isIntent(intent)) return { kind: "invalid" };
  if (intent.from === intent.to) return { kind: "noop" };
  try {
    const { data, error, status } = await client.rpc("update_client", { p_request_id: intent.requestId,
      p_client_id: intent.clientId, p_expected_version: intent.version, p_payload: { status: intent.to } });
    if (error?.code === "PT409" && error.message === "client_version_conflict") {
      const confirmed = await loadLatest(intent.clientId);
      return isClient(confirmed) && confirmed.id === intent.clientId && confirmed.version > intent.version ?
        { kind: "conflict", confirmed } : uncertain();
    }
    if (error && (!error.code || status === 0 || (status ?? 0) >= 500 ||
      error.code === "PT409" && error.message === "incomplete_request")) return uncertain();
    if (error) return { kind: "error", retry: false, message: error.code === "P0002" ?
      "No se encontró el cliente. Recargá Clientes." : "No se guardó el cambio. El cliente conserva su estado anterior." };
    return isClient(data) && data.id === intent.clientId && data.status === intent.to && data.version === intent.version + 1 ?
      { kind: "success", client: data } : uncertain();
  } catch { return uncertain(); }
}
