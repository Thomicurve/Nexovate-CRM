import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import Link from "next/link";
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
  const result = await getClient(id);
  if (result.kind === "missing") notFound();
  if (result.kind === "unavailable") return <div role="alert">No pudimos cargar el cliente. <Link href={`/clientes/${id}/editar`}>Reintentar</Link></div>;
  return <ClientModal key={result.client.id} client={result.client} action={saveClient} deleteAction={deleteClient} requestId={randomUUID()}
    initialContact="" returnTo={safeReturnPath(query.returnTo ?? "")} />;
}
