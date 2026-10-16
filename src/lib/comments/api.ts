import { UUID } from "@/lib/clients/model";
import { COMMENT_PAGE_SIZE, isComment, isCursor, validCommentText, type CommentPage, type CommentPageInput,
  type CommentResult, type CreateCommentIntent, type ArchiveCommentIntent } from "./model";
export type CommentRpc = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
  data: unknown; error: { code?: string; message?: string } | null; status?: number }> };
const uncertain = (): CommentResult => ({ kind: "error", retry: true,
  message: "No podemos confirmar la operación. Reintentá la misma intención antes de continuar." });
export async function performCommentMutation(client: CommentRpc, operation: "create" | "archive", value: unknown): Promise<CommentResult> {
  const intent = value as (CreateCommentIntent & ArchiveCommentIntent) | null;
  const fields = operation === "create" ? ["requestId", "clientId", "body"] : ["requestId", "clientId", "commentId"];
  if (!intent || typeof intent !== "object" || Object.keys(intent).length !== 3 || Object.keys(intent).some((key) => !fields.includes(key)) ||
    typeof intent.requestId !== "string" || !UUID.test(intent.requestId) || typeof intent.clientId !== "string" || !UUID.test(intent.clientId) ||
    (operation === "create" ? !validCommentText(intent.body) : typeof intent.commentId !== "string" || !UUID.test(intent.commentId))) return { kind: "invalid" };
  try {
    const { data, error, status } = await client.rpc(operation === "create" ? "create_client_comment" : "archive_client_comment", {
      p_request_id: intent.requestId, p_client_id: intent.clientId,
      ...(operation === "create" ? { p_body: intent.body } : { p_comment_id: intent.commentId }),
    });
    if (error && (!error.code || status === 0 || (status ?? 0) >= 500 || error.code === "PT409" && error.message === "incomplete_request")) return uncertain();
    if (error) return { kind: "error", retry: false, message: error.code === "P0002" ? "El cliente o comentario ya no está disponible." :
      error.code === "42501" ? "No tenés permiso para esta operación." : "No se guardó la operación. Revisá los datos y reintentá." };
    const receipt = data as { request_id?: unknown; comment?: unknown } | null;
    if (receipt?.request_id !== intent.requestId || !isComment(receipt.comment) || receipt.comment.client_id !== intent.clientId ||
      (operation === "create" ? receipt.comment.body !== intent.body || receipt.comment.legacy || receipt.comment.archived_at !== null :
        receipt.comment.id !== intent.commentId || receipt.comment.archived_at === null)) return uncertain();
    return { kind: "success", comment: receipt.comment };
  } catch { return uncertain(); }
}
export async function readCommentPage(client: CommentRpc, value: unknown): Promise<CommentPage> {
  const input = value as CommentPageInput | null;
  if (!input || typeof input !== "object" || Object.keys(input).some((key) => !["clientId", "archived", "cursor"].includes(key)) ||
    typeof input.clientId !== "string" || !UUID.test(input.clientId) || typeof input.archived !== "boolean" ||
    input.cursor != null && !isCursor(input.cursor)) return { kind: "invalid" };
  try {
    const { data, error } = await client.rpc("list_client_comments", { p_client_id: input.clientId, p_archived: input.archived,
      p_before_at: input.cursor?.at ?? null, p_before_id: input.cursor?.id ?? null, p_limit: COMMENT_PAGE_SIZE });
    if (error) return { kind: error.code === "P0002" ? "missing" : "unavailable" };
    const page = data as { rows?: unknown; next?: unknown } | null;
    if (!Array.isArray(page?.rows) || page.rows.length > COMMENT_PAGE_SIZE || !page.rows.every((row) =>
      isComment(row) && row.client_id === input.clientId && (row.archived_at !== null) === input.archived) ||
      !(page.next === null || isCursor(page.next)) || page.next !== null && !page.rows.length) return { kind: "unavailable" };
    return { kind: "found", rows: page.rows, next: page.next };
  } catch { return { kind: "unavailable" }; }
}
