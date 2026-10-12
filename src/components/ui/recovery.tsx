"use client";
import { useRef, type ReactNode } from "react";
import { LoadingLink } from "./loading-navigation";
import { usePanelMotion } from "./motion";
import styles from "./feedback.module.css";

export function RecoveryPanel({ title, children, retry, returnTo = "/clientes", retryHref }: {
  title: string; children: ReactNode; retry?: () => void; returnTo?: string; retryHref?: string;
}) {
  const panel = useRef<HTMLElement>(null); usePanelMotion(panel, true);
  return <div className={styles.page}><section className={styles.panel} ref={panel} aria-labelledby="recovery-title">
    <h1 id="recovery-title">{title}</h1><div role="alert">{children}</div>
    <div className={styles.actions}>
      {retry && <button type="button" onClick={retry}>Reintentar carga</button>}
      {retryHref && <LoadingLink href={retryHref}>Reintentar carga</LoadingLink>}
      <LoadingLink href={returnTo}>Volver a clientes</LoadingLink>
    </div>
  </section></div>;
}
export function PageError({ reset }: { reset: () => void; error?: Error & { digest?: string } }) {
  return <RecoveryPanel title="No pudimos mostrar esta página" retry={reset}>
    <p>Reintentá la carga o volvé a Clientes.</p>
    <p>Si estabas guardando, borrando o moviendo un cliente, revisá el resultado en Clientes antes de intentarlo otra vez.</p>
  </RecoveryPanel>;
}
export function PageNotFound() {
  return <RecoveryPanel title="Página no encontrada"><p>La dirección no existe o el cliente ya no está disponible. Volvé a tu cartera para continuar.</p></RecoveryPanel>;
}
