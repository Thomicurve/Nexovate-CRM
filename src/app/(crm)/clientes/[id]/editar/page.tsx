import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMember } from "@/lib/auth/require-member";
import { getClient } from "@/lib/clients/server";
import { safeReturnPath } from "@/lib/clients/model";
import { ClientForm } from "@/components/clients/client-form";
import { saveClient } from "../../actions";
import styles from "@/components/clients/clients.module.css";
export default async function EditClientPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }>;
}) {
  await requireMember();
  const { id } = await params, query = await searchParams;
  const result = await getClient(id);
  if (result.kind === "missing") notFound();
  if (result.kind === "unavailable") return <div role="alert">No pudimos cargar el cliente. <Link href={`/clientes/${id}/editar`}>Reintentar</Link></div>;
  return <div className={styles.page}>
    <ClientForm key={result.client.version} client={result.client} action={saveClient} requestId={randomUUID()}
      initialContact="" returnTo={safeReturnPath(query.returnTo ?? "")} /></div>;
}
