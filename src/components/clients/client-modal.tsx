"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { safeReturnPath, type Client } from "@/lib/clients/model";
import { ClientForm, type ClientFormProps } from "./client-form";
import styles from "./clients.module.css";

type Props = ClientFormProps & { onClose?: () => void; onSaved?: (client: Client) => void };
export function ClientModal({ onClose, onSaved, ...form }: Props) {
  const router = useRouter(), titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null), blocked = useRef(false), closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [locked, setLocked] = useState(false), [closing, setClosing] = useState(false);
  const exit = useRef(false);
  useEffect(() => {
    const surface = dialog.current!, opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    surface.showModal();
    document.body.style.overflow = "hidden";
    surface.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      surface.close(); document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
      else document.querySelector<HTMLElement>('[aria-label="Vista de clientes"] [aria-current]')?.focus();
    };
  }, []);
  function close(saved?: Client) {
    if (exit.current || blocked.current && !saved) return;
    exit.current = true; setClosing(true);
    const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 200;
    closeTimer.current = setTimeout(() => {
      if (saved && onSaved) onSaved(saved);
      else if (onClose) onClose();
      else router.replace(safeReturnPath(form.returnTo));
    }, delay);
  }
  return <dialog ref={dialog} aria-labelledby={titleId} aria-modal="true" className={styles.modal} data-closing={closing || undefined}
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className={styles.modalHeader}><h1 id={titleId}>{form.client ? "Editar cliente" : "Nuevo cliente"}</h1>
      <button type="button" aria-label="Cerrar formulario" disabled={locked || closing} onClick={() => close()}>×</button></header>
    <ClientForm {...form} embedded closing={closing} onCancel={() => close()} onSuccess={(client) => close(client)}
      onLockChange={(next) => { blocked.current = next; setLocked(next); }} />
  </dialog>;
}
