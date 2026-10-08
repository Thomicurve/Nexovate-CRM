import Link from "next/link";
import { requireMember } from "@/lib/auth/require-member";
import styles from "@/components/clients/clients.module.css";
export default async function ClientsPage() {
  await requireMember();
  return <section className={styles.destination}><h1>Clientes</h1>
    <div className={styles.actions}><Link href="/clientes/nuevo">Nuevo cliente</Link></div></section>;
}
