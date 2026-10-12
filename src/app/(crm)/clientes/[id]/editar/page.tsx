import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { RecoveryPanel } from "@/components/ui/recovery";
import { requireMember } from "@/lib/auth/require-member";
import { getClient } from "@/lib/clients/server";
import { safeReturnPath } from "@/lib/clients/model";
import { ClientModal } from "@/components/clients/client-modal";
import { deleteClient, saveClient } from "../../actions";
export default async function EditClientPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }>;
}) {
  await requireMember();
  const { id } = await params, query = await searchParams;
  const returnTo = safeReturnPath(query.returnTo ?? "");
  const result = await getClient(id);
  if (result.kind === "missing") notFound();
  if (result.kind === "unavailable") return <RecoveryPanel title="No pudimos cargar el cliente" returnTo={returnTo}
    retryHref={`/clientes/${encodeURIComponent(id)}/editar?returnTo=${encodeURIComponent(returnTo)}`}>
    <p>Reintentá la carga para consultar la versión actual o volvé a tu cartera con el mismo contexto.</p>
  </RecoveryPanel>;
  return <ClientModal key={result.client.id} client={result.client} action={saveClient} deleteAction={deleteClient} requestId={randomUUID()}
    initialContact="" returnTo={returnTo} />;
}
