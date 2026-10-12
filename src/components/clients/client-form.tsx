"use client";

import { LoadingLink as Link } from "@/components/ui/loading-navigation";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { isClient, safeReturnPath, STATUSES, type Client, type SaveState } from "@/lib/clients/model";
import { useNotification } from "@/components/ui/notifications";
import { utcToLocal } from "@/lib/clients/dates";
import { usePendingLoading } from "@/components/ui/global-loading";
import styles from "./clients.module.css";
import HoldButton from "@/components/ui/HoldButton";
import type { DeleteIntent, DeleteResult } from "@/lib/clients/delete";
import { ClientConfirmation } from "./client-confirmation";
import { focusAfterLoading, useClientFormExit, type ExitGuard } from "./client-form-exit";

type FormValues = { name: string; company: string; email: string; phone: string; rubro: string; notes: string;
  contact_at: string; meeting_at: string; status: string };
type Draft = { values: FormValues; originalContact: string; originalMeeting: string };
const initialValues = (client: Client | undefined, contact: string): FormValues => ({ name: client?.name ?? "", company: client?.company ?? "",
  email: client?.email ?? "", phone: client?.phone ?? "", rubro: client?.rubro ?? "", notes: client?.notes ?? "",
  contact_at: client ? utcToLocal(client.contact_at) : contact,
  meeting_at: client?.meeting_at ? utcToLocal(client.meeting_at) : "", status: client?.status ?? "Contactado" });

export type ClientFormProps = { client?: Client; requestId: string; initialContact: string; returnTo: string;
  action: (state: SaveState, form: FormData) => Promise<SaveState>; embedded?: boolean; closing?: boolean;
  deleteAction?: (intent: DeleteIntent) => Promise<DeleteResult>; onDeleted?: () => void;
  onSuccess?: (client: Client) => void; onCancel?: () => void; onLockChange?: (locked: boolean) => void;
  onRegisterExit?: (guard: ExitGuard | null) => void };
type Props = ClientFormProps;
export function ClientForm(props: Props) {
  const [client, setClient] = useState(props.client);
  const [generation, setGeneration] = useState(0);
  const [request, setRequest] = useState(props.requestId);
  const [draft, setDraft] = useState<Draft>();
  return <FormBody key={generation} {...props} client={client} requestId={request} focusOnMount={generation > 0} draft={draft}
    resume={(confirmed, retained) => { setClient(confirmed); setDraft(retained); setRequest(crypto.randomUUID()); setGeneration((value) => value + 1); }} />;
}

function FormBody({ client, requestId, initialContact, returnTo, action, deleteAction, onDeleted, resume, focusOnMount, embedded, closing, onSuccess, onCancel, onLockChange, onRegisterExit, draft }: Props & { resume: (client: Client, draft?: Draft) => void; focusOnMount: boolean; draft?: Draft }) {
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
      if (result.status === "conflict" && (!isClient(result.confirmed) || result.confirmed.id !== client?.id || result.confirmed.version < client.version)) {
        return { status: "error", retry: true, message: "No podemos confirmar la versión actual. Reintentá con los mismos datos antes de salir." };
      }
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
  const [values, setValues] = useState<FormValues>(() => draft?.values ?? initialValues(client, initialContact));
  const originalContact = draft?.originalContact ?? client?.contact_at ?? "", originalMeeting = draft?.originalMeeting ?? client?.meeting_at ?? "";
  const baseline = initialValues(client, initialContact);
  const dirty = (Object.keys(values) as (keyof FormValues)[]).some((key) => values[key] !== baseline[key]);
  const [discard, setDiscard] = useState<{ leave: () => void; cancelLabel?: string; message?: string } | null>(null), [confirmDelete, setConfirmDelete] = useState(false);
  const summary = useRef<HTMLDivElement>(null), formElement = useRef<HTMLFormElement>(null);
  // Passive focus runs after the pending loading dialog releases its top layer.
  useEffect(() => { if (state.status === "invalid") return focusAfterLoading(() => summary.current); }, [state]);
  const frozen = state.status === "error" && state.retry === true;
  const deleteUnavailable = pending || frozen || state.status === "success" || Boolean(closing) || navigating ||
    deletePending || deleteResult?.kind === "success" || deleteResult?.kind === "conflict";
  const blockedExit = disabled || frozen || navigating;
  const exitState = useRef({ dirty, blocked: blockedExit });
  useLayoutEffect(() => { exitState.current = { dirty, blocked: blockedExit }; });
  const guard = useCallback<ExitGuard>((leave) => {
    if (exitState.current.blocked) return;
    if (exitState.current.dirty) setDiscard({ leave }); else leave();
  }, []);
  useLayoutEffect(() => { onRegisterExit?.(guard); return () => onRegisterExit?.(null); }, [onRegisterExit, guard]);
  useClientFormExit(dirty, blockedExit, guard, (href) => {
    if (/^https?:/.test(href)) location.assign(href); else transition(() => router.push(href));
  });
  const leave = () => { if (onCancel) onCancel(); else transition(() => router.replace(safeReturnPath(returnTo))); };
  function leaveAfterDeleteConflict() {
    if (deleteResult?.kind !== "conflict" || pending || frozen || closing || navigating || deletePending) return;
    const confirmedExit = () => { onLockChange?.(false); leave(); };
    // This settled conflict permits explicit exit, but never unlocks stale editing
    // or another deletion while the user is deciding whether to keep the draft.
    if (exitState.current.dirty) setDiscard({ leave: confirmedExit, cancelLabel: "Conservar borrador",
      message: "Tu borrador se conserva con los campos bloqueados. Para revisar la versión actual, necesitás volver a Clientes. Descartar cierra este borrador sin guardarlo." });
    else confirmedExit();
  }
  const cancel = onCancel ? <button type="button" className={styles.secondaryButton} disabled={blockedExit} onClick={() => guard(leave)}>Cancelar</button> :
    <Link href={safeReturnPath(returnTo)} data-client-cancel="" aria-disabled={blockedExit} tabIndex={blockedExit ? -1 : undefined}
      onClick={(event) => { event.preventDefault(); guard(leave); }}>Cancelar</Link>;
  const confirmations = <>
    {discard && <ClientConfirmation title="¿Descartar los cambios?" confirmLabel="Descartar" cancelLabel={discard.cancelLabel} onCancel={() => setDiscard(null)}
      onConfirm={() => { const next = discard.leave; setDiscard(null); next(); }}><p>{discard.message ?? "Tenés cambios sin guardar. Podés seguir editando tu borrador."}</p></ClientConfirmation>}
    {confirmDelete && client && <ClientConfirmation title={`Borrar ${client.name}`} confirmLabel="Confirmar borrado" onCancel={() => setConfirmDelete(false)}
      onConfirm={() => { setConfirmDelete(false); void remove(); }}><p>El cliente desaparecerá de la lista. Su historial y sus métricas permanecen.</p></ClientConfirmation>}
  </>;
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
  if (state.status === "conflict" && state.confirmed) {
    const current = state.confirmed;
    const rows = [["Nombre", values.name, current.name], ["Empresa", values.company, current.company], ["Rubro", values.rubro, current.rubro],
      ["Email", values.email, current.email], ["Teléfono", values.phone, current.phone], ["Estado", values.status, current.status],
      ["Contacto", values.contact_at, utcToLocal(current.contact_at)], ["Reunión", values.meeting_at, current.meeting_at ? utcToLocal(current.meeting_at) : null],
      ["Notas", values.notes, current.notes]];
    return <section className={embedded ? styles.modalForm : styles.formPanel}>
      <h2>Este cliente cambió</h2><p role="alert">Tus cambios no se guardaron. Compará tu borrador con los datos actuales.</p>
      <p className={styles.hint}>Versión confirmada: {current.version}</p>
      <div className={styles.conflictComparison}>
        <div aria-label="Mi borrador"><h3>Mi borrador</h3><dl>{rows.map(([label, own]) => <div key={label}><dt>{label}</dt><dd>{own || "Sin informar"}</dd></div>)}</dl></div>
        <div aria-label="Datos actuales"><h3>Datos actuales</h3><dl>{rows.map(([label, , latest]) => <div key={label}><dt>{label}</dt><dd>{latest || "Sin informar"}</dd></div>)}</dl></div>
      </div>
      <p className={styles.hint}>Elegí cómo retomar la edición. Después podrás revisar y guardar con la versión actual.</p>
      <div className={styles.actions}><button type="button" onClick={() => resume(current, { values, originalContact, originalMeeting })}>Continuar con mi borrador</button>
        <button type="button" className={styles.secondaryButton} onClick={() => resume(current)}>Usar datos actuales</button>{cancel}</div>{confirmations}
    </section>;
  }
  return (
    <section className={embedded ? styles.modalForm : styles.formPanel}>
      {!embedded && <h1>{client ? "Editar cliente" : "Nuevo cliente"}</h1>}
      <p className={styles.hint}>* Obligatorio. Fechas en horario de Buenos Aires.</p>
      {!client && <p className={styles.hint}>El cliente se crea en Contactado.</p>}
      <form ref={formElement} tabIndex={-1} action={submit} noValidate aria-busy={disabled} onSubmit={() => onLockChange?.(true)}>
        <input type="hidden" name="request_id" value={intent} />
        <input type="hidden" name="client_id" value={client?.id ?? ""} />
        <input type="hidden" name="version" value={client?.version ?? ""} />
        <input type="hidden" name="initial_contact" value={initialContact} />
        <input type="hidden" name="original_contact" value={originalContact} />
        <input type="hidden" name="original_meeting" value={originalMeeting} />
        <input type="hidden" name="return_to" value={returnTo} />
        {state.status === "invalid" && <div ref={summary} role="alert" tabIndex={-1} className={styles.errorSummary}>
          <h2>Revisá los campos</h2><p>{state.message || "Corregí estos datos antes de guardar."}</p>
          <ul>{Object.entries(state.errors ?? {}).map(([name, message]) => <li key={name}><a href={`#${name}`} onClick={(event) => {
            event.preventDefault(); const target = formElement.current?.elements.namedItem(name);
            if (target instanceof HTMLElement) target.focus(); else formElement.current?.focus();
          }}>{message}</a></li>)}</ul>
        </div>}
        <fieldset className={styles.formGroup}><legend>Datos del cliente</legend><div className={styles.grid}>
          <div className={styles.wide}>{field("name", "Nombre *", "text", 200)}</div>
          {field("company", "Empresa", "text", 200)}{field("rubro", "Rubro", "text", 120)}
          {field("email", "Email", "email", 254)}{field("phone", "Teléfono", "tel", 60)}
        </div></fieldset>
        <fieldset className={styles.formGroup}><legend>Contacto y seguimiento</legend><div className={styles.grid}>
          {field("contact_at", "Fecha de contacto *", "datetime-local")}{field("meeting_at", "Fecha de reunión", "datetime-local")}
          {client && <div className={`${styles.field} ${styles.wide}`}><label htmlFor="status">Estado</label>
            <select id="status" name="status" value={values.status} disabled={disabled || frozen}
              onChange={(event) => change("status", event.target.value)} aria-invalid={Boolean(state.errors?.status)} aria-describedby={state.errors?.status ? "status-error" : undefined}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>{frozen && <input type="hidden" name="status" value={values.status} />}
            {state.errors?.status && <p id="status-error" className={styles.error}>{state.errors.status}</p>}</div>}
        </div></fieldset>
        <fieldset className={styles.formGroup}><legend>Notas</legend>
          <div className={styles.field}><label htmlFor="notes">Notas</label>
            <textarea id="notes" name="notes" value={values.notes} maxLength={5000} readOnly={frozen} disabled={disabled}
              onChange={(event) => change("notes", event.target.value)} aria-invalid={Boolean(state.errors?.notes)} aria-describedby={state.errors?.notes ? "notes-error" : undefined} />
            {state.errors?.notes && <p id="notes-error" className={styles.error}>{state.errors.notes}</p>}</div>
        </fieldset>
        {state.message && state.status !== "invalid" && <p className={styles.error} role="alert">{state.message}</p>}
        <div className={styles.actions}><button type="submit" disabled={disabled}>
          {state.status === "success" ? "Guardado" : pending ? "Guardando…" : frozen ? "Reintentar" : client ? "Guardar cambios" : "Crear cliente"}
        </button>{cancel}</div>
      </form>
      {client && deleteAction && <section className={styles.deleteSection} aria-label="Borrar cliente">
        <h2>Borrar cliente</h2><p>El cliente desaparecerá de la lista. Su historial y sus métricas permanecen.</p>
        <p className={styles.hint}>Mantené el botón durante 2 segundos. Soltar antes cancela.</p>
        {deleteResult?.kind === "conflict" ? <><p className={styles.error} role="alert">El cliente cambió mientras lo editabas. Volvé a Clientes para revisar la versión actual antes de borrar.</p>
          <button type="button" onClick={leaveAfterDeleteConflict}>Volver a Clientes</button></> :
          deleteResult?.kind === "error" ? <><p className={styles.error} role="alert">{deleteResult.message}</p>
            <button type="button" disabled={deleteUnavailable} onClick={remove}>Reintentar borrado</button></> :
          <><button type="button" disabled={deleteUnavailable} className={styles.secondaryButton} onClick={() => setConfirmDelete(true)}>Borrar con confirmación</button>
          <HoldButton holdTime={2000} doneLabel="Confirmando borrado…" disabled={disabled || frozen || navigating} onHold={remove}
            size="lg" backgroundColor="#121f35" fillColor="#f0aeb5" textColor="#f0aeb5" fillTextColor="#080e1b"
            className={styles.deleteButton}>Mantener para borrar</HoldButton></>}
      </section>}
      {confirmations}
    </section>
  );
}
