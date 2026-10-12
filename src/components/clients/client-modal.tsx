"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { safeReturnPath, type Client } from "@/lib/clients/model";
import { ClientForm, type ClientFormProps } from "./client-form";
import { lockPageScroll, usePendingLoading } from "@/components/ui/global-loading";
import styles from "./clients.module.css";
import { usePanelMotion } from "@/components/ui/motion";
import type { ExitGuard } from "./client-form-exit";

type Props = ClientFormProps & { onClose?: () => void; onSaved?: (client: Client) => void };
export function ClientModal({ onClose, onSaved, ...form }: Props) {
  const router = useRouter(), titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null), blocked = useRef(false), guard = useRef<ExitGuard | null>(null);
  const [locked, setLocked] = useState(false), [closing, setClosing] = useState(false);
  const exit = useRef(false);
  const [navigating, transition] = useTransition();
  usePendingLoading(navigating, "navigation");
  usePanelMotion(dialog, true);
  useEffect(() => {
    const surface = dialog.current!, opener = document.activeElement as HTMLElement | null;
    const releaseScroll = lockPageScroll();
    surface.showModal();
    surface.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    return () => {
      surface.close(); releaseScroll();
      queueMicrotask(() => {
        if (opener?.isConnected) opener.focus();
        else document.querySelector<HTMLElement>('[aria-label="Vista de clientes"] [aria-checked="true"]')?.focus();
      });
    };
  }, []);
  function close(saved?: Client, deleted = false) {
    if (exit.current || blocked.current && !saved && !deleted) return;
    exit.current = true; setClosing(true);
    if (deleted && form.onDeleted) form.onDeleted();
    else if (saved && onSaved) onSaved(saved);
    else if (onClose) onClose();
    else transition(() => {
      const destination = new URL(safeReturnPath(form.returnTo), "https://local.invalid");
      // A standalone edit has no list count; the first filtered page is always valid.
      if (deleted) destination.searchParams.delete("pagina");
      router.replace(destination.pathname + destination.search);
    });
  }
  const requestClose = () => { if (guard.current) guard.current(() => close()); else close(); };
  return <dialog ref={dialog} aria-labelledby={titleId} aria-modal="true" className={styles.modal} data-closing={closing || undefined}
    onCancel={(event) => { event.preventDefault(); requestClose(); }} onKeyDown={(event) => {
      if (event.key !== "Tab" || event.target instanceof Element && event.target.closest("dialog") !== dialog.current) return;
      const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <header className={styles.modalHeader}><h1 id={titleId}>{form.client ? "Editar cliente" : "Nuevo cliente"}</h1>
      <button type="button" aria-label="Cerrar formulario" disabled={locked || closing} onClick={requestClose}>×</button></header>
    <ClientForm {...form} embedded closing={closing} onCancel={() => close()} onSuccess={(client) => close(client)}
      onDeleted={() => close(undefined, true)}
      onRegisterExit={(next) => { guard.current = next; }}
      onLockChange={(next) => { blocked.current = next; setLocked(next); }} />
  </dialog>;
}
