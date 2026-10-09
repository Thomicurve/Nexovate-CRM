"use client";

import { LoadingLink as Link } from "@/components/ui/loading-navigation";
import { useRouter } from "next/navigation";
import { useActionState, useLayoutEffect, useRef, useState, useTransition } from "react";
import { isClient, safeReturnPath, STATUSES, type Client, type SaveState } from "@/lib/clients/model";
import { useNotification } from "@/components/ui/notifications";
import { utcToLocal } from "@/lib/clients/dates";
import { usePendingLoading } from "@/components/ui/global-loading";
import styles from "./clients.module.css";
import HoldButton from "@/components/ui/HoldButton";
import type { DeleteIntent, DeleteResult } from "@/lib/clients/delete";

export type ClientFormProps = { client?: Client; requestId: string; initialContact: string; returnTo: string;
  action: (state: SaveState, form: FormData) => Promise<SaveState>; embedded?: boolean; closing?: boolean;
  deleteAction?: (intent: DeleteIntent) => Promise<DeleteResult>; onDeleted?: () => void;
  onSuccess?: (client: Client) => void; onCancel?: () => void; onLockChange?: (locked: boolean) => void };
type Props = ClientFormProps;
export function ClientForm(props: Props) {
  const [client, setClient] = useState(props.client);
  const [generation, setGeneration] = useState(0);
  const [request, setRequest] = useState(props.requestId);
  return <FormBody key={generation} {...props} client={client} requestId={request} focusOnMount={generation > 0}
    resume={(confirmed) => { setClient(confirmed); setRequest(crypto.randomUUID()); setGeneration((value) => value + 1); }} />;
}

function FormBody({ client, requestId, initialContact, returnTo, action, deleteAction, onDeleted, resume, focusOnMount, embedded, closing, onSuccess, onCancel, onLockChange }: Props & { resume: (client: Client) => void; focusOnMount: boolean }) {
  const router = useRouter(), notify = useNotification();
  const [navigating, transition] = useTransition();
  usePendingLoading(navigating);
  const firstField = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { if (focusOnMount) firstField.current?.focus(); }, [focusOnMount]);
  const deletion = useRef<DeleteIntent | null>(null), deleting = useRef(false);
  const [deletePending, setDeletePending] = useState(false), [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);
  usePendingLoading(deletePending);
  async function remove() {
    if (!client || !deleteAction || deleting.current || deleteUnavailable) return;
    deletion.current ??= Object.freeze({ requestId: crypto.randomUUID(), clientId: client.id, version: client.version });
    deleting.current = true; setDeletePending(true); onLockChange?.(true);
    let result: DeleteResult;
    try { result = await deleteAction(deletion.current); }
    catch { result = { kind: "error", retry: true, message: "No podemos confirmar el borrado. Reintentá la misma intención." }; }
    setDeleteResult(result); setDeletePending(false); deleting.current = false;
    if (result.kind === "success") {
      notify("Cliente eliminado", client.name);
      if (onDeleted) onDeleted(); else transition(() => router.replace(safeReturnPath(returnTo)));
    } else onLockChange?.(result.kind === "conflict" || result.kind === "error" && result.retry);
  }
  const [state, submit, pending] = useActionState(async (previous: SaveState, form: FormData): Promise<SaveState> => {
    onLockChange?.(true);
    try {
      const result = await action(previous, form);
      if (result.status === "success") {
        if (!isClient(result.client)) return { status: "error", retry: true, message: "No podemos confirmar el guardado. Reintentá con los mismos datos." };
        notify(client ? "Cliente actualizado" : "Cliente creado", result.client.name);
        if (onSuccess) onSuccess(result.client);
        else transition(() => router.replace(safeReturnPath(returnTo)));
      }
      onLockChange?.(result.status === "success" || result.status === "error" && result.retry === true);
      return result;
    }
    catch (error) {
      // Preserve native transport failures; framework redirects keep their control flow.
      if (!(error instanceof TypeError)) throw error;
      return { status: "error", retry: true, message: "No podemos confirmar el guardado. Reintentá con los mismos datos antes de salir." };
    }
  }, { status: "idle" } as SaveState);
  usePendingLoading(pending);
  const deleteLocked = deletePending || deleteResult?.kind === "success" || deleteResult?.kind === "conflict" || deleteResult?.kind === "error" && deleteResult.retry;
  const disabled = pending || state.status === "success" || Boolean(closing) || deleteLocked;
  const [intent, setIntent] = useState(requestId);
  const [values, setValues] = useState({ name: client?.name ?? "", company: client?.company ?? "",
    email: client?.email ?? "", phone: client?.phone ?? "", rubro: client?.rubro ?? "", notes: client?.notes ?? "",
    contact_at: client ? utcToLocal(client.contact_at) : initialContact,
    meeting_at: client?.meeting_at ? utcToLocal(client.meeting_at) : "", status: client?.status ?? "Contactado" });
  const frozen = state.status === "error" && state.retry === true;
  const deleteUnavailable = pending || frozen || state.status === "success" || Boolean(closing) || navigating ||
    deletePending || deleteResult?.kind === "success" || deleteResult?.kind === "conflict";
  const cancel = onCancel ? <button type="button" className={styles.secondaryButton} disabled={disabled || frozen} onClick={onCancel}>Cancelar</button> :
    <Link href={returnTo} aria-disabled={disabled || frozen} tabIndex={disabled || frozen ? -1 : undefined}
      onClick={(event) => { if (disabled || frozen) event.preventDefault(); }}>Cancelar</Link>;
  const change = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (state.status === "invalid" || state.status === "error" && !state.retry) setIntent(crypto.randomUUID());
  };
  const field = (name: keyof typeof values, label: string, type = "text", maxLength?: number) => (
    <div className={styles.field}>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} maxLength={maxLength} value={values[name]}
        ref={name === "name" ? firstField : undefined}
        required={name === "name" || name === "contact_at"} readOnly={frozen} disabled={disabled}
        onChange={(event) => change(name, event.target.value)}
        aria-invalid={Boolean(state.errors?.[name])} aria-describedby={`${name}-hint${state.errors?.[name] ? ` ${name}-error` : ""}`} />
      <span id={`${name}-hint`} className={styles.hint}>
        {name === "contact_at" ? "Se completa al crear y se puede corregir." :
          name === "meeting_at" ? "La fecha de la cita no cambia el primer hito de Reunión agendada." : ""}
      </span>
      {state.errors?.[name] && <p id={`${name}-error`} className={styles.error}>{state.errors[name]}</p>}
    </div>
  );
  if (state.status === "conflict" && state.confirmed) return (
    <section className={embedded ? styles.modalForm : styles.panel}>
      {!embedded && <h1>Editar cliente</h1>}
      <p className={styles.error} role="alert">Este cliente se actualizó mientras lo editabas.</p>
      <p>Versión confirmada: {state.confirmed.version}</p>
      <dl className={styles.confirmed}>
        {[["Nombre", state.confirmed.name], ["Empresa", state.confirmed.company], ["Email", state.confirmed.email],
          ["Teléfono", state.confirmed.phone], ["Rubro", state.confirmed.rubro], ["Estado", state.confirmed.status],
          ["Contacto", utcToLocal(state.confirmed.contact_at)], ["Cita", state.confirmed.meeting_at ? utcToLocal(state.confirmed.meeting_at) : null],
          ["Notas", state.confirmed.notes]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Sin informar"}</dd></div>)}
      </dl>
      <p className={styles.hint}>Tus cambios no se guardaron. Volvé a editar la versión confirmada.</p>
      <div className={styles.actions}><button type="button" onClick={() => resume(state.confirmed!)}>Volver a editar</button>
        {cancel}</div>
    </section>
  );
  return (
    <section className={embedded ? styles.modalForm : styles.panel}>
      {!embedded && <h1>{client ? "Editar cliente" : "Nuevo cliente"}</h1>}
      <p className={styles.hint}>* Obligatorio. Fechas en horario de Buenos Aires.</p>
      {!client && <p className={styles.hint}>El cliente se crea en Contactado.</p>}
      <form action={submit} noValidate aria-busy={disabled} onSubmit={() => onLockChange?.(true)}>
        <input type="hidden" name="request_id" value={intent} />
        <input type="hidden" name="client_id" value={client?.id ?? ""} />
        <input type="hidden" name="version" value={client?.version ?? ""} />
        <input type="hidden" name="initial_contact" value={initialContact} />
        <input type="hidden" name="original_contact" value={client?.contact_at ?? ""} />
        <input type="hidden" name="original_meeting" value={client?.meeting_at ?? ""} />
        <input type="hidden" name="return_to" value={returnTo} />
        <div className={styles.grid}>
          {field("name", "Nombre *", "text", 200)}{field("company", "Empresa", "text", 200)}
          {field("email", "Email", "email", 254)}{field("phone", "Teléfono", "tel", 60)}
          {field("rubro", "Rubro", "text", 120)}{field("contact_at", "Fecha de contacto *", "datetime-local")}
          {client && <div className={styles.field}><label htmlFor="status">Estado</label>
            <select id="status" name="status" value={values.status} disabled={disabled || frozen}
              onChange={(event) => change("status", event.target.value)} aria-invalid={Boolean(state.errors?.status)}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>{frozen && <input type="hidden" name="status" value={values.status} />}
            {state.errors?.status && <p className={styles.error}>{state.errors.status}</p>}</div>}
          {field("meeting_at", "Fecha de reunión", "datetime-local")}
          <div className={`${styles.field} ${styles.wide}`}><label htmlFor="notes">Notas</label>
            <textarea id="notes" name="notes" value={values.notes} maxLength={5000} readOnly={frozen} disabled={disabled}
              onChange={(event) => change("notes", event.target.value)} aria-invalid={Boolean(state.errors?.notes)} />
            {state.errors?.notes && <p className={styles.error}>{state.errors.notes}</p>}</div>
        </div>
        {state.message && <p className={styles.error} role="alert">{state.message}</p>}
        <div className={styles.actions}><button type="submit" disabled={disabled}>
          {state.status === "success" ? "Guardado" : pending ? "Guardando…" : frozen ? "Reintentar" : client ? "Guardar cambios" : "Crear cliente"}
        </button>{cancel}</div>
      </form>
      {client && deleteAction && <section className={styles.deleteSection} aria-label="Borrar cliente">
        <h2>Borrar cliente</h2><p>El cliente desaparecerá de la lista. Su historial y sus métricas permanecen.</p>
        <p className={styles.hint}>Mantené el botón durante 2 segundos. Soltar antes cancela.</p>
        {deleteResult?.kind === "conflict" ? <><p className={styles.error} role="alert">El cliente cambió mientras lo editabas. Volvé a Clientes para revisar la versión actual antes de borrar.</p>
          <button type="button" onClick={() => { onLockChange?.(false); if (onCancel) onCancel(); else transition(() => router.replace(safeReturnPath(returnTo))); }}>Volver a Clientes</button></> :
          deleteResult?.kind === "error" ? <><p className={styles.error} role="alert">{deleteResult.message}</p>
            <button type="button" disabled={deleteUnavailable} onClick={remove}>Reintentar borrado</button></> :
          <HoldButton holdTime={2000} doneLabel="Confirmando borrado…" disabled={disabled || frozen || navigating} onHold={remove}
            size="lg" backgroundColor="#121f35" fillColor="#f0aeb5" textColor="#f0aeb5" fillTextColor="#080e1b"
            className={styles.deleteButton}>Mantener para borrar</HoldButton>}
      </section>}
    </section>
  );
}
