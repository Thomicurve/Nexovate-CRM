"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CLIENT_TIME_ZONE } from "@/lib/clients/dates";
import { listPath, PAGE_SIZE, parseFilters, type ListResult } from "@/lib/clients/filters";
import { STATUSES, type ClientStatus } from "@/lib/clients/model";
import styles from "./clients.module.css";
import { ClientKanban } from "./client-kanban";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: CLIENT_TIME_ZONE,
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const displayDate = (value: string) => dateFormatter.format(new Date(value)).replace(",", "");

export function ClientList({ result: incoming }: { result: ListResult }) {
  const [locked, setLocked] = useState(false), [result, setResult] = useState(incoming);
  if (incoming !== result && !locked) setResult(incoming);
  const empty = parseFilters({});
  if (!empty.ok) throw new Error("Invalid default filters");
  const applied = result.kind === "invalid" ? empty.filters : result.filters;
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

  return <section className={styles.destination}>
    <h1>Clientes</h1><div className={styles.viewBar} onClick={(event) => { if (locked) event.preventDefault(); }}>
      <nav className={styles.viewSwitch} aria-label="Vista de clientes">{[["kanban", "Kanban"], ["tabla", "Tabla"]].map(([view, label]) =>
        <Link key={view} href={listPath({ ...applied, view: view as "kanban" | "tabla" })} aria-current={applied.view === view ? "page" : undefined}
          aria-disabled={locked} tabIndex={locked ? -1 : undefined}>{label}</Link>)}</nav>
      <div className={styles.actions}><Link aria-disabled={locked} tabIndex={locked ? -1 : undefined}
        href={`/clientes/nuevo?returnTo=${encodeURIComponent(returnTo)}`}>Nuevo cliente</Link></div></div>
    <form className={styles.filterBar} action="/clientes" method="get" onSubmit={() => setBusy(true)} aria-busy={busy}>
      {viewField}<fieldset className={styles.filterLock} disabled={locked}>
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
    {result.kind === "invalid" && <p className={styles.error} role="alert">{result.message}</p>}
    {result.kind === "unavailable" && <div className={styles.listState}><p className={styles.error} role="alert">No pudimos cargar los clientes.</p>
      <div className={styles.actions}><Link href={returnTo}>Reintentar</Link></div></div>}
    {result.kind === "out_of_range" && <div className={styles.listState}><p>Esta página ya no tiene resultados.</p>
      <div className={styles.actions}><Link href={listPath(applied, 1)}>Volver a la primera página</Link></div></div>}
    {result.kind === "found" && applied.view === "kanban" && <ClientKanban rows={result.rows} returnTo={returnTo} onLock={setLocked} />}
    {result.kind === "found" && (result.rows.length ? applied.view === "tabla" && <div className={styles.tableSurface}>
      <table className={styles.table} aria-label="Clientes"><thead><tr>
        <th scope="col">Cliente</th><th scope="col" className={styles.optionalColumn}>Rubro</th><th scope="col">Estado</th>
        <th scope="col" className={styles.optionalColumn}>Contacto</th><th scope="col" className={styles.optionalColumn}>Cita</th><th scope="col">Acciones</th>
      </tr></thead><tbody>{result.rows.map((row) => <tr key={row.id}>
        <td><span className={styles.clientName}>{row.name}</span><span className={styles.company}>{row.company || "Sin empresa"}</span>
          <span className={styles.mobileContact}>Contacto: {displayDate(row.contact_at)}</span></td>
        <td className={styles.optionalColumn}>{row.rubro || "Sin informar"}</td><td><span className={styles.status}>{row.status}</span></td>
        <td className={styles.optionalColumn}>{displayDate(row.contact_at)}</td><td className={styles.optionalColumn}>{row.meeting_at ? displayDate(row.meeting_at) : "Sin cita"}</td>
        <td><Link className={styles.editLink} aria-label={`Editar ${row.name}`} href={`/clientes/${row.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}>Editar</Link></td>
      </tr>)}</tbody></table></div> : <div className={styles.listState}>
        <p>{result.count > 0 ? "Esta página ya no tiene clientes." : active ? "No hay clientes que coincidan con los filtros." : "Todavía no hay clientes."}</p>
        <p className={styles.hint}>{active ? "Probá cambiar o limpiar los filtros." : "Agregá el primer cliente para comenzar el seguimiento."}</p></div>)}
    {result.kind === "found" && (result.count > PAGE_SIZE || applied.page > 1) && <nav className={styles.pagination} aria-label="Páginas de clientes"
      onClick={(event) => { if (locked) event.preventDefault(); }}>
      {applied.page > 1 && <Link aria-disabled={locked} tabIndex={locked ? -1 : undefined} href={listPath(applied, applied.page - 1)}>Anterior</Link>}
      <span>Página {applied.page} · {result.count} clientes</span>
      {applied.page * PAGE_SIZE < result.count && <Link aria-disabled={locked} tabIndex={locked ? -1 : undefined} href={listPath(applied, applied.page + 1)}>Siguiente</Link>}
    </nav>}
  </section>;
}
