"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { CLIENT_TIME_ZONE, utcToLocal } from "@/lib/clients/dates";
import { listPath, PAGE_SIZE, parseFilters, type ListResult } from "@/lib/clients/filters";
import { STATUSES, type Client, type ClientStatus } from "@/lib/clients/model";
import { saveClient } from "@/app/(crm)/clientes/actions";
import styles from "./clients.module.css";
import { ClientKanban } from "./client-kanban";
import { ClientModal } from "./client-modal";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: CLIENT_TIME_ZONE,
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const displayDate = (value: string) => dateFormatter.format(new Date(value)).replace(",", "");

export function ClientList({ result: incoming }: { result: ListResult }) {
  const router = useRouter();
  const [locked, setLocked] = useState(false), [result, setResult] = useState(incoming);
  const [modal, setModal] = useState<{ client?: Client; requestId: string; initialContact: string } | null>(null);
  const [seenIncoming, setSeenIncoming] = useState(incoming);
  const [view, setView] = useState(incoming.kind === "invalid" ? "kanban" : incoming.filters.view);
  const [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [seenPending, setSeenPending] = useState(false);
  const refreshGuard = useRef(false);
  const modalOpener = useRef<HTMLElement | null>(null), currentView = useRef<HTMLAnchorElement | null>(null);
  const savedFocus = useRef<{ opener: HTMLElement | null; snapshot: ListResult } | null>(null);
  useLayoutEffect(() => { refreshGuard.current = refreshing; }, [refreshing]);
  useEffect(() => {
    const saved = savedFocus.current;
    if (!saved || modal || pending || result === saved.snapshot) return;
    if (!saved.opener?.isConnected && document.activeElement === document.body) currentView.current?.focus();
    savedFocus.current = null;
  }, [result, modal, pending]);
  if (incoming !== seenIncoming && !locked) {
    setSeenIncoming(incoming);
    const failed = refreshing && incoming.kind === "unavailable";
    if (!failed || result.kind !== "found") setResult(incoming);
    setRefreshError(failed);
    setRefreshing(false);
    if (incoming.kind !== "invalid") setView(incoming.filters.view);
  }
  if (pending !== seenPending) {
    setSeenPending(pending);
    // A completed transition without data must leave a retryable page.
    if (!pending && refreshing && incoming === seenIncoming) {
      setRefreshing(false); setRefreshError(true);
    }
  }
  function refresh() {
    if (locked || refreshGuard.current || pending) return;
    refreshGuard.current = true;
    setRefreshing(true); setRefreshError(false);
    startTransition(() => router.refresh());
  }
  const empty = parseFilters({});
  if (!empty.ok) throw new Error("Invalid default filters");
  const applied = { ...(result.kind === "invalid" ? empty.filters : result.filters), view };
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(applied);
  const trigger = useRef<HTMLButtonElement>(null), nameInput = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) nameInput.current?.focus();
    else if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const close = () => { setDraft(applied); setOpen(false); };
  const active = Boolean(applied.name || applied.statuses.length || applied.from || applied.until);
  const returnTo = listPath(applied);
  useEffect(() => {
    const restoreView = () => {
      if (locked || modal) { window.history.replaceState(null, "", returnTo); return; }
      setView(new URLSearchParams(window.location.search).get("vista") === "tabla" ? "tabla" : "kanban");
    };
    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, [locked, modal, returnTo]);
  function openModal(event: MouseEvent<HTMLAnchorElement>, client?: Client) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    beginModal(client, event.currentTarget);
  }
  function beginModal(client: Client | undefined, opener: HTMLElement) {
    if (locked || refreshing || pending || modal) return;
    modalOpener.current = opener;
    setModal({ client, requestId: crypto.randomUUID(), initialContact: client ? "" : utcToLocal(new Date().toISOString()) });
  }
  const clearPath = listPath({ ...applied, name: "", statuses: [], from: "", until: "", page: 1 });
  const viewField = <input type="hidden" name="vista" value={applied.view} />;
  const dateFields = (panel: boolean) => <div className={panel ? styles.filterDates : styles.barDates}>
    {[["from", "desde", "Desde"], ["until", "hasta", "Hasta"]].map(([key, name, label]) => <div className={styles.field} key={name}>
      <label htmlFor={name}>{label}</label><input id={name} name={name} type="date" min="1900-01-01" max="9999-12-31"
        value={draft[key as "from" | "until"]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
    </div>)}
  </div>;
  const nameField = <div className={styles.field}><label htmlFor="filter-name">Nombre</label>
    <input id="filter-name" ref={nameInput} name="nombre" maxLength={200} value={draft.name}
      onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>;
  const toggle = (state: ClientStatus) => setDraft({ ...draft, statuses: STATUSES.filter((value) =>
    value === state ? !draft.statuses.includes(value) : draft.statuses.includes(value)) });

  if (open) return <section className={styles.filterPanel} aria-labelledby="filter-title"
    onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
    <h1 id="filter-title">Filtrar clientes</h1>
    <form action="/clientes" method="get" onSubmit={() => setBusy(true)} aria-busy={busy}>
      {viewField}
      {nameField}
      <fieldset className={styles.stateOptions}><legend>Estados</legend>
        {STATUSES.map((state) => <label key={state} className={draft.statuses.includes(state) ? styles.selectedState : ""}>
          <input type="checkbox" name="estado" value={state} checked={draft.statuses.includes(state)} onChange={() => toggle(state)} />{state}
        </label>)}
      </fieldset>
      {dateFields(true)}
      <p className={styles.hint}>Incluye ambos días. Horario de Buenos Aires.</p>
      <div className={`${styles.actions} ${styles.filterActions}`}><button type="submit" disabled={busy}>Aplicar filtros</button>
        <Link href={clearPath}>Limpiar filtros</Link><button type="button" className={styles.secondaryButton} onClick={close}>Cancelar</button></div>
    </form>
  </section>;

  return <section className={styles.destination} aria-busy={refreshing || pending}>
    <h1>Clientes</h1><div className={styles.viewBar} onClick={(event) => { if (locked) event.preventDefault(); }}>
      <nav className={styles.viewSwitch} aria-label="Vista de clientes">{[["kanban", "Kanban"], ["tabla", "Tabla"]].map(([view, label]) =>
        <a key={view} ref={applied.view === view ? currentView : undefined} href={listPath({ ...applied, view: view as "kanban" | "tabla" })} aria-current={applied.view === view ? "page" : undefined}
          aria-disabled={locked || refreshing} tabIndex={locked || refreshing ? -1 : undefined} onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            if (locked || refreshing || applied.view === view) return;
            window.history.pushState(null, "", event.currentTarget.href);
            setView(view as "kanban" | "tabla");
          }}>{label}</a>)}</nav>
      <div className={styles.actions}><button type="button" className={styles.refreshButton} disabled={locked || refreshing || pending} onClick={refresh}>
        {refreshing || pending ? "Actualizando…" : "Actualizar"}</button><Link prefetch={false} aria-disabled={locked} tabIndex={locked ? -1 : undefined}
        href={`/clientes/nuevo?returnTo=${encodeURIComponent(returnTo)}`} onClick={(event) => openModal(event)}>Nuevo cliente</Link></div></div>
    <form className={styles.filterBar} action="/clientes" method="get" onSubmit={() => setBusy(true)} aria-busy={busy}>
      {viewField}<fieldset className={styles.filterLock} disabled={locked || refreshing || pending}>
      <div className={styles.desktopFilter}>{nameField}</div>
      <div className={styles.statesTrigger}><span className={styles.desktopFilter}>Estados</span>
        <button type="button" ref={trigger} aria-label="Filtros de clientes" onClick={() => setOpen(true)}>
          <span className={styles.desktopFilter}>{draft.statuses.length ? `${draft.statuses.length} estados seleccionados` : "Todos los estados"}</span>
          <span className={styles.mobileFilter}>Filtros · {active ? "activos" : "ninguno activo"}</span></button></div>
      {draft.statuses.map((state) => <input key={state} type="hidden" name="estado" value={state} />)}
      <div className={styles.desktopFilter}>{dateFields(false)}</div>
      <div className={`${styles.actions} ${styles.desktopFilter}`}><button type="submit" disabled={busy}>Aplicar</button>
        <Link href={clearPath} aria-disabled={locked} tabIndex={locked ? -1 : undefined} onClick={(event) => { if (locked) event.preventDefault(); }}>Limpiar</Link></div>
      </fieldset>
    </form>
    {busy && <p role="status">Cargando clientes…</p>}
    {(refreshing || pending) && <p role="status">Actualizando clientes…</p>}
    {refreshError && result.kind === "found" && <div className={styles.actions}>
      <p className={styles.error} role="alert">No pudimos actualizar los clientes. Se conserva la última lista.</p>
      <button type="button" disabled={locked || refreshing || pending} onClick={refresh}>Reintentar actualización</button></div>}
    {result.kind === "invalid" && <p className={styles.error} role="alert">{result.message}</p>}
    {result.kind === "unavailable" && <div className={styles.listState}><p className={styles.error} role="alert">No pudimos cargar los clientes.</p>
      <div className={styles.actions}><button type="button" disabled={refreshing || pending} onClick={refresh}>Reintentar</button></div></div>}
    {result.kind === "out_of_range" && <div className={styles.listState}><p>Esta página ya no tiene resultados.</p>
      <div className={styles.actions}><Link href={listPath(applied, 1)}>Volver a la primera página</Link></div></div>}
    <div key={view} className={styles.viewContent}>
    {result.kind === "found" && applied.view === "kanban" && <ClientKanban rows={result.rows} returnTo={returnTo} onLock={setLocked} onEdit={beginModal} />}
    {result.kind === "found" && (result.rows.length ? applied.view === "tabla" && <div className={styles.tableSurface}>
      <table className={styles.table} aria-label="Clientes"><thead><tr>
        <th scope="col">Cliente</th><th scope="col" className={styles.optionalColumn}>Rubro</th><th scope="col">Estado</th>
        <th scope="col" className={styles.optionalColumn}>Contacto</th><th scope="col" className={styles.optionalColumn}>Cita</th><th scope="col">Acciones</th>
      </tr></thead><tbody>{result.rows.map((row) => <tr key={row.id}>
        <td><span className={styles.clientName}>{row.name}</span><span className={styles.company}>{row.company || "Sin empresa"}</span>
          <span className={styles.mobileContact}>Contacto: {displayDate(row.contact_at)}</span></td>
        <td className={styles.optionalColumn}>{row.rubro || "Sin informar"}</td><td><span className={styles.status}>{row.status}</span></td>
        <td className={styles.optionalColumn}>{displayDate(row.contact_at)}</td><td className={styles.optionalColumn}>{row.meeting_at ? displayDate(row.meeting_at) : "Sin cita"}</td>
        <td><Link prefetch={false} className={styles.editLink} aria-label={`Editar ${row.name}`} href={`/clientes/${row.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}
          onClick={(event) => openModal(event, row)}>Editar</Link></td>
      </tr>)}</tbody></table></div> : <div className={styles.listState}>
        <p>{result.count > 0 ? "Esta página ya no tiene clientes." : active ? "No hay clientes que coincidan con los filtros." : "Todavía no hay clientes."}</p>
        <p className={styles.hint}>{active ? "Probá cambiar o limpiar los filtros." : "Agregá el primer cliente para comenzar el seguimiento."}</p></div>)}
    </div>
    {result.kind === "found" && (result.count > PAGE_SIZE || applied.page > 1) && <nav className={styles.pagination} aria-label="Páginas de clientes"
      onClick={(event) => { if (locked) event.preventDefault(); }}>
      {applied.page > 1 && <Link aria-disabled={locked} tabIndex={locked ? -1 : undefined} href={listPath(applied, applied.page - 1)}>Anterior</Link>}
      <span>Página {applied.page} · {result.count} clientes</span>
      {applied.page * PAGE_SIZE < result.count && <Link aria-disabled={locked} tabIndex={locked ? -1 : undefined} href={listPath(applied, applied.page + 1)}>Siguiente</Link>}
    </nav>}
    {modal && <ClientModal {...modal} action={saveClient} returnTo={returnTo} onClose={() => setModal(null)}
      onSaved={() => { savedFocus.current = { opener: modalOpener.current, snapshot: result }; setModal(null); startTransition(() => router.refresh()); }} />}
  </section>;
}
