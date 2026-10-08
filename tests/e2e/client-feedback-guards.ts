import { UUID, type Client } from "../../src/lib/clients/model";
import type { TrackedRequest } from "./clients-live-recovery";
export function isClientActionUrl(url: URL) {
  return url.pathname === "/clientes" || url.pathname.startsWith("/clientes/");
}

export function assertFeedbackWrite(actor: string, requestId: unknown, clientId: unknown, name: unknown,
  prefix: string, requests: TrackedRequest[], fixtures: Map<string, Client>) {
  const registered = requests.find((row) => row.actor === actor && row.id === requestId);
  const creates = requests.filter((row) => row.clientId === null);
  if (!UUID.test(actor) || typeof requestId !== "string" || !UUID.test(requestId) || !registered || registered.rolledBack ||
    registered.clientId !== clientId || creates.length > 2 || fixtures.size > 2 ||
    typeof name !== "string" && clientId === null || typeof name === "string" && !name.startsWith(`${prefix}-`) ||
    clientId !== null && (typeof clientId !== "string" || !UUID.test(clientId) || !fixtures.get(clientId)?.name.startsWith(`${prefix}-`)))
    throw new Error("Unowned or unregistered feedback write; blocked before execution");
}

export function assertFeedbackSave(form: FormData, actor: string, prefix: string, requests: TrackedRequest[], fixtures: Map<string, Client>) {
  const field = (name: string) => {
    const values = [...form].filter(([key]) => key.replace(/^\d+_/, "") === name).map(([, value]) => value);
    if (values.length !== 1 || typeof values[0] !== "string") throw new Error("Unknown feedback form; blocked before execution");
    return values[0];
  };
  assertFeedbackWrite(actor, field("request_id"), field("client_id") || null, field("name"), prefix, requests, fixtures);
}

// Only aggregates leave the server. No customer rows or auth timestamps are returned.
export function feedbackFingerprintQuery(ids: string[]) {
  if (ids.length > 2 || ids.some((id) => !UUID.test(id))) throw new Error("Invalid fingerprint exclusions");
  const array = ids.length ? `ARRAY[${ids.map((id) => `'${id}'`).join(",")}]` : "ARRAY[]";
  const tables = [["public.clients", `id=ANY(${array}::uuid[])`],
    ["public.client_transitions", `client_id=ANY(${array}::uuid[])`],
    ["public.client_milestones", `client_id=ANY(${array}::uuid[])`],
    ["public.client_contact_corrections", `client_id=ANY(${array}::uuid[])`],
    ["crm_private.client_requests", `COALESCE((response->>'id')=ANY(${array}::text[]),false) OR COALESCE((envelope->>'client_id')=ANY(${array}::text[]),false)`]];
  return tables.map(([table, own]) => `SELECT '${table}' AS table_name,count(*)::integer AS count,
    encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'[]'),'UTF8')),'hex') AS hash
    FROM ${table} t WHERE NOT (${own})`).join(" UNION ALL ") + " ORDER BY table_name";
}
