"use server";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/require-member";
import { performCommentMutation, readCommentPage } from "@/lib/comments/api";
export async function loadClientComments(input: unknown) {
  const { client, userId } = await requireMember();
  return { ...(await readCommentPage(client, input)), userId };
}
export async function createClientComment(intent: unknown) {
  const { client } = await requireMember();
  const result = await performCommentMutation(client, "create", intent);
  if (result.kind === "success") revalidatePath("/clientes");
  return result;
}
export async function archiveClientComment(intent: unknown) {
  const { client } = await requireMember();
  const result = await performCommentMutation(client, "archive", intent);
  if (result.kind === "success") revalidatePath("/clientes");
  return result;
}
