"use server";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/require-member";
import { performSave } from "@/lib/clients/mutations";
import { getClient } from "@/lib/clients/server";
import { type SaveState } from "@/lib/clients/model";
import { performMove, type MoveResult } from "@/lib/clients/moves";
import { performDelete, type DeleteResult } from "@/lib/clients/delete";
export async function deleteClient(intent: unknown): Promise<DeleteResult> {
  const { client } = await requireMember();
  const result = await performDelete(client, intent);
  if (result.kind === "success") { revalidatePath("/clientes"); revalidatePath("/dashboard"); }
  return result;
}
export async function moveClient(intent: unknown): Promise<MoveResult> {
  const { client } = await requireMember();
  const result = await performMove(client, intent, async (id) => {
    const latest = await getClient(id);
    return latest.kind === "found" ? latest.client : null;
  });
  if (result.kind === "success") revalidatePath("/clientes");
  return result;
}
export async function saveClient(_previous: SaveState, form: FormData): Promise<SaveState> {
  const { client } = await requireMember();
  const result = await performSave(client, form, async (id) => {
    const latest = await getClient(id);
    return latest.kind === "found" ? latest.client : null;
  });
  if (result.status === "success" && result.client) {
    revalidatePath("/clientes");
  }
  return result;
}
