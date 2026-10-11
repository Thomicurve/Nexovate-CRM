"use client";
import { useEffect, useRef, type MouseEvent } from "react";
import { LoadingLink as Link } from "@/components/ui/loading-navigation";
import { lockPageScroll } from "@/components/ui/global-loading";
import { usePanelMotion } from "@/components/ui/motion";
import { CLIENT_TIME_ZONE } from "@/lib/clients/dates";
import type { Client } from "@/lib/clients/model";
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
    ["Notas", client.notes || "Sin notas"],
  ];
  return <dialog ref={dialog} className={styles.readDetail} aria-labelledby="client-detail-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const targets = [...event.currentTarget.querySelectorAll<HTMLElement>("button, a[href]")];
        const next = event.shiftKey && document.activeElement === targets[0] ? targets.at(-1) :
          !event.shiftKey && document.activeElement === targets.at(-1) ? targets[0] : undefined;
        if (next) { event.preventDefault(); next.focus(); }
      }
    }}>
    <header className={styles.detailHeader}><h2 id="client-detail-title">{client.name}</h2>
      <button ref={close} className="ui-button ghost-button" type="button" onClick={onClose}>Cerrar</button></header>
    <dl className={styles.detailFields}>{fields.map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <Link prefetch={false} className={styles.detailEdit} aria-label={`Editar ${client.name}`}
      href={`/clientes/${client.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}
      onClick={(event) => {
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) editing.current = true;
        onEdit(event);
      }}>Editar cliente</Link>
  </dialog>;
}
