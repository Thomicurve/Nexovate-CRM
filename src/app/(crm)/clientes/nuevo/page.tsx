import { randomUUID } from "node:crypto";
import { requireMember } from "@/lib/auth/require-member";
import { ClientModal } from "@/components/clients/client-modal";
import { utcToLocal } from "@/lib/clients/dates";
import { safeReturnPath } from "@/lib/clients/model";
import { saveClient } from "../actions";
export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  await requireMember();
  const query = await searchParams;
  return <ClientModal action={saveClient} requestId={randomUUID()}
    initialContact={utcToLocal(new Date().toISOString())} returnTo={safeReturnPath(query.returnTo ?? "")} />;
}
