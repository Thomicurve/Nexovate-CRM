import "server-only";
import { requireMember } from "@/lib/auth/require-member";
import { isClient, UUID } from "./model";
import { PAGE_SIZE, parseFilters, type ListResult, type SearchParams } from "./filters";
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

export async function listClients(params: SearchParams): Promise<ListResult> {
  const { client } = await requireMember();
  const parsed = parseFilters(params);
  if (!parsed.ok) return { kind: "invalid", message: parsed.message };
  const filters = parsed.filters;
  try {
    let query = client.from("clients").select(CLIENT_FIELDS, { count: "exact" });
    if (filters.name) query = query.regexIMatch("name", filters.name.replace(/[.*+?^${}()|[\]\\]/g, (value) => `\\${value}`));
    if (filters.statuses.length) query = query.in("status", filters.statuses);
    if (filters.fromUtc) query = query.gte("contact_at", filters.fromUtc);
    if (filters.untilUtc) query = query.lt("contact_at", filters.untilUtc);
    const offset = (filters.page - 1) * PAGE_SIZE;
    const { data, count, error, status } = await query.order("contact_at", { ascending: false }).order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (filters.page > 1 && status === 416 && error?.code === "PGRST103") return { kind: "out_of_range", filters };
    if (error || !Array.isArray(data) || !data.every(isClient) || count === null || !Number.isSafeInteger(count) || count < 0 ||
      data.length !== Math.min(PAGE_SIZE, Math.max(0, count - offset))) return { kind: "unavailable", filters };
    return { kind: "found", filters, rows: data, count };
  } catch { return { kind: "unavailable", filters }; }
}
