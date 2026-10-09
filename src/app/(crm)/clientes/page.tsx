import { requireMember } from "@/lib/auth/require-member";
import { listClients } from "@/lib/clients/server";
import { ClientList } from "@/components/clients/client-list";
import { listPath, type SearchParams } from "@/lib/clients/filters";
export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireMember();
  const params = await searchParams;
  // Presentation-only history changes must keep the current rows and local context.
  const result = await listClients(params);
  const dataKey = result.kind === "invalid" ? JSON.stringify(params) : listPath({ ...result.filters, view: "kanban" });
  return <ClientList key={dataKey} result={result} />;
}
