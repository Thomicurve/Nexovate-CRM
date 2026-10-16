import { UUID } from "@/lib/clients/model";
export const COMMENT_PAGE_SIZE = 30;
export type ClientComment = {
  id: string; client_id: string; body: string; legacy: boolean;
  author_id: string | null; author_email: string | null; created_at: string | null;
  imported_at: string | null; sort_at: string;
  archived_by: string | null; archived_by_email: string | null; archived_at: string | null;
};
export type CommentCursor = Readonly<{ at: string; id: string }>;
export type CommentPageInput = Readonly<{ clientId: string; archived: boolean; cursor?: CommentCursor | null }>;
export type CommentPage = { kind: "found"; rows: ClientComment[]; next: CommentCursor | null } |
  { kind: "unavailable" | "missing" | "invalid" };
export type CreateCommentIntent = Readonly<{ requestId: string; clientId: string; body: string }>;
export type ArchiveCommentIntent = Readonly<{ requestId: string; clientId: string; commentId: string }>;
export type CommentResult = { kind: "success"; comment: ClientComment } | { kind: "invalid" } |
  { kind: "error"; retry: boolean; message: string };
const instant = (value: unknown): value is string => typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const nullableId = (value: unknown) => value === null || typeof value === "string" && UUID.test(value);
const nullableEmail = (value: unknown) => value === null || typeof value === "string" && value.length <= 254;
export function validCommentText(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && [...value].length <= 5000;
}
export function isCursor(value: unknown): value is CommentCursor {
  if (!value || typeof value !== "object") return false;
  const cursor = value as CommentCursor;
  return Object.keys(cursor).length === 2 && instant(cursor.at) && typeof cursor.id === "string" && UUID.test(cursor.id);
}
export function isComment(value: unknown): value is ClientComment {
  if (!value || typeof value !== "object") return false;
  const row = value as ClientComment;
  return typeof row.id === "string" && UUID.test(row.id) && typeof row.client_id === "string" && UUID.test(row.client_id) &&
    typeof row.body === "string" && typeof row.legacy === "boolean" && instant(row.sort_at) &&
    nullableId(row.author_id) && nullableEmail(row.author_email) && nullableId(row.archived_by) && nullableEmail(row.archived_by_email) &&
    (row.legacy ? row.author_id === null && row.author_email === null && row.created_at === null && instant(row.imported_at) && row.sort_at === row.imported_at :
      row.author_id !== null && instant(row.created_at) && row.imported_at === null && row.sort_at === row.created_at && validCommentText(row.body)) &&
    (row.archived_at === null ? row.archived_by === null && row.archived_by_email === null : instant(row.archived_at) && row.archived_by !== null);
}
