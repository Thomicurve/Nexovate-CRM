import { UUID } from "./model";
export type DeleteIntent = Readonly<{ requestId: string; clientId: string; version: number }>;
export type DeleteResult = { kind: "success" } | { kind: "conflict" | "invalid" } |
  { kind: "error"; retry: boolean; message: string };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
  data: unknown; error: { code?: string; message?: string } | null; status?: number }> };
const uncertain = (): DeleteResult => ({ kind: "error", retry: true,
  message: "No podemos confirmar el borrado. Reintentá la misma intención antes de continuar." });
export async function performDelete(client: RpcClient, value: unknown): Promise<DeleteResult> {
  const intent = value as DeleteIntent | null;
  if (!intent || typeof intent !== "object" || Object.keys(intent).length !== 3 ||
    typeof intent.requestId !== "string" || !UUID.test(intent.requestId) ||
    typeof intent.clientId !== "string" || !UUID.test(intent.clientId) ||
    !Number.isSafeInteger(intent.version) || intent.version < 1 || intent.version >= Number.MAX_SAFE_INTEGER) return { kind: "invalid" };
  try {
    const { data, error, status } = await client.rpc("delete_client", { p_request_id: intent.requestId,
      p_client_id: intent.clientId, p_expected_version: intent.version });
    if (error?.code === "PT409" && error.message === "client_version_conflict") return { kind: "conflict" };
    if (error && (!error.code || status === 0 || (status ?? 0) >= 500 ||
      error.code === "PT409" && error.message === "incomplete_request")) return uncertain();
    if (error) return { kind: "error", retry: false, message: error.code === "P0002" ?
      "El cliente ya no está disponible. Volvé a Clientes y actualizá la lista." : "No se borró el cliente. Reintentá o volvé a Clientes." };
    const receipt = data as { client_id?: unknown; request_id?: unknown; version?: unknown; deleted_at?: unknown } | null;
    return receipt?.client_id === intent.clientId && receipt.request_id === intent.requestId &&
      receipt.version === intent.version + 1 && typeof receipt.deleted_at === "string" &&
      Number.isFinite(Date.parse(receipt.deleted_at)) ? { kind: "success" } : uncertain();
  } catch { return uncertain(); }
}
