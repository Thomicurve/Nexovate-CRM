import { randomUUID } from "node:crypto";
import { requireMember } from "@/lib/auth/require-member";
import { ClientForm } from "@/components/clients/client-form";
import { utcToLocal } from "@/lib/clients/dates";
import { safeReturnPath } from "@/lib/clients/model";
import { saveClient } from "../actions";
import styles from "@/components/clients/clients.module.css";
export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  await requireMember();
  const query = await searchParams;
  return <div className={styles.page}><ClientForm action={saveClient} requestId={randomUUID()}
    initialContact={utcToLocal(new Date().toISOString())} returnTo={safeReturnPath(query.returnTo ?? "")} /></div>;
}
