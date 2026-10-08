import "server-only";
import { requireMember } from "@/lib/auth/require-member";
import { isClient, UUID } from "./model";
export const CLIENT_FIELDS = "id,name,company,rubro,email,phone,notes,status,contact_at,meeting_at,version,created_at,updated_at";
export async function getClient(id: string) {
  const { client } = await requireMember();
  if (!UUID.test(id)) return { kind: "missing" as const };
  try {
    const { data, error } = await client.from("clients").select(CLIENT_FIELDS).eq("id", id).maybeSingle();
    if (error) return { kind: "unavailable" as const };
    if (!data) return { kind: "missing" as const };
    return isClient(data) ? { kind: "found" as const, client: data } : { kind: "unavailable" as const };
  } catch { return { kind: "unavailable" as const }; }
}
