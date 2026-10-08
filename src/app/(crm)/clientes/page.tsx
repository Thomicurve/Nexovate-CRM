import { requireMember } from "@/lib/auth/require-member";
import { listClients } from "@/lib/clients/server";
import { ClientList } from "@/components/clients/client-list";
import type { SearchParams } from "@/lib/clients/filters";
export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireMember();
  const params = await searchParams;
  return <ClientList key={JSON.stringify(params)} result={await listClients(params)} />;
}
