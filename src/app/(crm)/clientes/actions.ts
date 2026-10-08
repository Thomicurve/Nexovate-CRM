"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/require-member";
import { performSave } from "@/lib/clients/mutations";
import { getClient } from "@/lib/clients/server";
import { safeReturnPath, type SaveState } from "@/lib/clients/model";
export async function saveClient(_previous: SaveState, form: FormData): Promise<SaveState> {
  const { client } = await requireMember();
  const result = await performSave(client, form, async (id) => {
    const latest = await getClient(id);
    return latest.kind === "found" ? latest.client : null;
  });
  if (result.status === "success" && result.client) {
    revalidatePath("/clientes");
    const returnTo = safeReturnPath(String(form.get("return_to") ?? ""));
    redirect(`/clientes/${result.client.id}/editar?guardado=1&returnTo=${encodeURIComponent(returnTo)}`);
  }
  return result;
}
