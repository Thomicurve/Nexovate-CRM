"use client";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { LoadingLink as Link } from "@/components/ui/loading-navigation";
import { lockPageScroll } from "@/components/ui/global-loading";
import { usePanelMotion } from "@/components/ui/motion";
import { CLIENT_TIME_ZONE } from "@/lib/clients/dates";
import type { Client } from "@/lib/clients/model";
import { ClientComments } from "./client-comments";
import type { ExitGuard } from "./client-form-exit";
import styles from "./clients.module.css";

const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: CLIENT_TIME_ZONE,
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const displayClientDate = (value: string) => formatter.format(new Date(value)).replace(",", "");

function emailHref(value: string | null) {
  return value && value.length <= 254 && /^[^\s@<>:]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(value)
    ? `mailto:${encodeURIComponent(value)}` : undefined;
}
function phoneHref(value: string | null) {
  if (!value || !/^\+?[\d\s().-]+$/.test(value)) return undefined;
  const normalized = value.replace(/[\s().-]/g, "");
  return /^\+?\d{6,15}$/.test(normalized) ? `tel:${normalized}` : undefined;
}

export function ClientDetails({ client, returnTo, opener, onClose, onEdit }: {
  client: Client; returnTo: string; opener: HTMLElement; onClose: () => void;
  onEdit: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), close = useRef<HTMLButtonElement>(null), editing = useRef(false);
  const exit = useRef<ExitGuard | null>(null), [locked, setLocked] = useState(false);
  const registerExit = useCallback((guard: ExitGuard | null) => { exit.current = guard; }, []);
  const requestClose = () => exit.current ? exit.current(onClose) : onClose();
  usePanelMotion(dialog, true);
  useEffect(() => {
    const surface = dialog.current!, release = lockPageScroll();
    surface.showModal(); close.current?.focus();
    return () => { surface.close(); release(); queueMicrotask(() => { if (!editing.current && opener.isConnected) opener.focus(); }); };
  }, [opener]);
  const email = emailHref(client.email), phone = phoneHref(client.phone);
  const fields = [
    ["Empresa", client.company || "Sin empresa"], ["Rubro", client.rubro || "Sin informar"], ["Estado", client.status],
    ["Email", email ? <a href={email} aria-label={`Enviar correo a ${client.name}`}>{client.email}</a> : client.email || "Sin informar"],
    ["Teléfono", phone ? <a href={phone} aria-label={`Llamar a ${client.name}`}>{client.phone}</a> : client.phone || "Sin informar"],
    ["Contacto", displayClientDate(client.contact_at)], ["Reunión", client.meeting_at ? displayClientDate(client.meeting_at) : "Sin cita"],
  ];
  return <dialog ref={dialog} className={styles.readDetail} aria-labelledby="client-detail-title"
    onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); requestClose(); }}
    onKeyDown={(event) => {
      if ((event.target as HTMLElement).closest("dialog") !== event.currentTarget) return;
      if (event.key === "Escape") { event.preventDefault(); requestClose(); }
      if (event.key === "Tab") {
        const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]:not([aria-disabled="true"]), textarea:not(:disabled), input:not(:disabled), [tabindex="0"]')]
          .filter((element) => element.closest("dialog") === event.currentTarget);
        const next = event.shiftKey && document.activeElement === targets[0] ? targets.at(-1) :
          !event.shiftKey && document.activeElement === targets.at(-1) ? targets[0] : undefined;
        if (next) { event.preventDefault(); next.focus(); }
      }
    }}>
    <header className={styles.detailHeader}><h2 id="client-detail-title">{client.name}</h2>
      <button ref={close} className="ui-button ghost-button" type="button" disabled={locked} onClick={requestClose}>Cerrar</button></header>
    <dl className={styles.detailFields}>{fields.map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <Link prefetch={false} className={styles.detailEdit} aria-label={`Editar ${client.name}`} data-client-cancel=""
      aria-disabled={locked} tabIndex={locked ? -1 : undefined}
      href={`/clientes/${client.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}
      onClick={(event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        const proceed = () => { editing.current = true; onEdit(event); };
        if (exit.current) exit.current(proceed); else proceed();
      }}>Editar cliente</Link>
    <ClientComments key={client.id} clientId={client.id} onRegisterExit={registerExit} onLockChange={setLocked} />
  </dialog>;
}
