import { isClient, normalizeForm, type Client, type SaveState } from "./model";
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
  data: unknown; error: { code?: string; message?: string; details?: string | null } | null; status?: number }> };
export async function performSave(client: RpcClient, form: FormData,
  loadLatest: (id: string) => Promise<Client | null>): Promise<SaveState> {
  const input = normalizeForm(form);
  if (!input.ok) return { status: "invalid", errors: input.errors, message: "Revisá los campos indicados." };
  let response;
  try {
    response = await client.rpc(input.mode === "create" ? "create_client" : "update_client", {
      p_request_id: input.requestId, p_payload: input.payload,
      ...(input.mode === "edit" ? { p_client_id: input.clientId, p_expected_version: input.version } : {}),
    });
  } catch {
    return { status: "error", retry: true, message: "No podemos confirmar el guardado. Reintentá con los mismos datos antes de salir." };
  }
  // The exact business message distinguishes stale versions from incomplete reservations.
  // Legacy 40001 is compatibility only; a genuine serialization error is never a UI conflict.
  const businessCode = response.error?.code === "PT409" || response.error?.code === "40001";
  if (businessCode && response.error?.message === "client_version_conflict" && input.mode === "edit") {
    const confirmed = await loadLatest(input.clientId);
    if (confirmed) return { status: "conflict", confirmed };
    return { status: "error", retry: true, message: "El cliente cambió. No pudimos cargar su versión confirmada. Reintentá." };
  }
  if (response.error && (businessCode && response.error.message === "incomplete_request" ||
    !response.error.code || response.status === 0 || (response.status ?? 0) >= 500)) {
    return { status: "error", retry: true, message: "No podemos confirmar el guardado. Reintentá con los mismos datos antes de salir." };
  }
  if (response.error) return { status: "error", retry: false,
    message: response.error.code === "P0002" ? "No se encontró el cliente. Volvé a Clientes." : "No se guardaron los cambios. Revisá los datos e intentá de nuevo." };
  if (!isClient(response.data)) return { status: "error", retry: true, message: "No podemos confirmar el guardado. Reintentá con los mismos datos." };
  return { status: "success", client: response.data };
}
