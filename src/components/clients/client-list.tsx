"use client";

import { LoadingLink as Link } from "@/components/ui/loading-navigation";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { utcToLocal } from "@/lib/clients/dates";
import { listPath, PAGE_SIZE, parseFilters, type ListResult } from "@/lib/clients/filters";
import type { Client } from "@/lib/clients/model";
import { deleteClient, saveClient } from "@/app/(crm)/clientes/actions";
import styles from "./clients.module.css";
import { ClientKanban } from "./client-kanban";
import { ClientModal } from "./client-modal";
import { usePendingLoading } from "@/components/ui/global-loading";
import { useLoadingFormNavigation } from "@/components/ui/loading-navigation";
import RubberSegment from "@/components/ui/RubberSegment";
import { ClientTable } from "./client-table";
import { ClientDetails } from "./client-details";
import { ClientFilters } from "./client-filters";

export function ClientList({ result: incoming }: { result: ListResult }) {
  const router = useRouter();
  const [locked, setLocked] = useState(false), [result, setResult] = useState(incoming);
  const [modal, setModal] = useState<{ client?: Client; requestId: string; initialContact: string } | null>(null);
  const [detail, setDetail] = useState<{ client: Client; opener: HTMLButtonElement } | null>(null);
  const [seenIncoming, setSeenIncoming] = useState(incoming);
  const [view, setView] = useState(incoming.kind === "invalid" ? "kanban" : incoming.filters.view);
  const [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState(false);
  const [pending, startTransition] = useTransition();
  usePendingLoading(pending || refreshing);
  const navigateFilters = useLoadingFormNavigation();
  const [seenPending, setSeenPending] = useState(false);
  const refreshGuard = useRef(false);
  const modalOpener = useRef<HTMLElement | null>(null), currentView = useRef<HTMLDivElement | null>(null);
  const savedFocus = useRef<{ opener: HTMLElement | null; snapshot: ListResult } | null>(null);
  useLayoutEffect(() => { refreshGuard.current = refreshing; }, [refreshing]);
  useEffect(() => {
    const saved = savedFocus.current;
    if (!saved || modal || pending || result === saved.snapshot) return;
    if (!saved.opener?.isConnected && document.activeElement === document.body) currentView.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
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
  const [open, setOpen] = useState(false), [search, setSearch] = useState(applied.name);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = Boolean(applied.name || applied.statuses.length || applied.from || applied.until);
  const returnTo = listPath(applied);
  useEffect(() => {
    const restoreView = () => {
      if (locked || modal || detail) { window.history.replaceState(null, "", returnTo); return; }
      setView(new URLSearchParams(window.location.search).get("vista") === "tabla" ? "tabla" : "kanban");
    };
    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, [locked, modal, detail, returnTo]);
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
  const filterCount = applied.statuses.length + Number(Boolean(applied.from || applied.until));
  const disabled = locked || refreshing || pending || Boolean(modal) || Boolean(detail);
  const removePath = (change: Partial<typeof applied>) => listPath({ ...applied, ...change, page: 1 });
  const viewField = <input type="hidden" name="vista" value={applied.view} />;
  const sortingFields = <><input type="hidden" name="orden" value={applied.sort} /><input type="hidden" name="direccion" value={applied.direction} /></>;
  return <section className={styles.destination} aria-busy={refreshing || pending}>
    <header className={styles.listHeading}><div><h1>Clientes</h1><p className="secondary">Encontrá y consultá tu cartera de clientes.</p></div>
      <div className={styles.actions}><button type="button" className={styles.refreshButton} disabled={disabled} onClick={refresh}>
        {refreshing || pending ? "Actualizando…" : "Actualizar"}</button>
        <Link prefetch={false} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined}
          href={`/clientes/nuevo?returnTo=${encodeURIComponent(returnTo)}`} onClick={(event) => openModal(event)}>Nuevo cliente</Link></div>
    </header>
    <div className={styles.listToolbar}>
      <form className={styles.searchForm} action="/clientes" method="get" role="search" onSubmit={navigateFilters}>
        {viewField}{sortingFields}{applied.statuses.map((state) => <input key={state} type="hidden" name="estado" value={state} />)}
        <input type="hidden" name="desde" value={applied.from} /><input type="hidden" name="hasta" value={applied.until} />
        <div className={styles.field}><label htmlFor="filter-name">Buscar por nombre o empresa</label>
          <input id="filter-name" name="nombre" type="search" maxLength={200} value={search} disabled={disabled}
            onChange={(event) => setSearch(event.target.value)} /></div><button type="submit" className={styles.searchButton} disabled={disabled}>Buscar</button>
      </form>
      <div ref={currentView}><RubberSegment aria-label="Vista de clientes" className={styles.viewSwitch}
        items={[{ value: "kanban", label: "Kanban" }, { value: "tabla", label: "Tabla" }]} value={applied.view}
        disabled={disabled} size="lg" radius={6} trackColor="#101827" thumbColor="#2059e8" textColor="#a6b5cc" activeTextColor="#ffffff"
        onChange={(next) => {
          if (disabled || next === applied.view || next !== "kanban" && next !== "tabla") return;
          window.history.pushState(null, "", listPath({ ...applied, view: next })); setView(next);
        }} /></div>
      <button type="button" className={styles.filtersButton} ref={trigger} disabled={disabled} aria-label="Filtros de clientes"
        aria-expanded={open} aria-controls={open ? "client-filters" : undefined} onClick={() => setOpen(!open)}>Filtros{filterCount ? ` (${filterCount})` : ""}</button>
    </div>
    {active && <div className={styles.filterChips} aria-label="Filtros aplicados">
      {applied.name && <Link href={removePath({ name: "" })} aria-label={"Quitar búsqueda " + applied.name} aria-disabled={disabled}
        onClick={(event) => { if (disabled) event.preventDefault(); }}>Búsqueda: {applied.name}<span aria-hidden="true"> ×</span></Link>}
      {applied.statuses.map((state) => <Link key={state} href={removePath({ statuses: applied.statuses.filter((value) => value !== state) })}
        aria-label={"Quitar estado " + state} aria-disabled={disabled} onClick={(event) => { if (disabled) event.preventDefault(); }}>{state}<span aria-hidden="true"> ×</span></Link>)}
      {(applied.from || applied.until) && <Link href={removePath({ from: "", until: "" })} aria-label="Quitar fechas de contacto" aria-disabled={disabled}
        onClick={(event) => { if (disabled) event.preventDefault(); }}>Contacto: {applied.from || "sin inicio"} a {applied.until || "sin fin"}<span aria-hidden="true"> ×</span></Link>}
      <Link href={clearPath} aria-disabled={disabled} onClick={(event) => { if (disabled) event.preventDefault(); }}>Limpiar filtros</Link>
    </div>}
    {open && <ClientFilters applied={applied} search={search} disabled={disabled} trigger={trigger} onClose={() => setOpen(false)} />}
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
    {result.kind === "found" && (result.rows.length ? applied.view === "tabla" && <ClientTable rows={result.rows} filters={applied} disabled={disabled}
      onRead={(client, opener) => setDetail({ client, opener })} /> : <div className={styles.listState}>
        <p>{result.count > 0 ? "Esta página ya no tiene clientes." : active ? "No hay clientes que coincidan con los filtros." : "Todavía no hay clientes."}</p>
        <p className={styles.hint}>{result.count > 0 ? "Volvé a la primera página para ver los clientes disponibles." : active ? "Probá cambiar o limpiar los filtros." : "Agregá el primer cliente para comenzar el seguimiento."}</p>
        <div className={styles.actions}>{result.count > 0 ? <Link href={listPath(applied, 1)}>Volver a la primera página</Link> : active ? <Link href={clearPath}>Limpiar filtros</Link> :
          <Link href={`/clientes/nuevo?returnTo=${encodeURIComponent(returnTo)}`} prefetch={false} onClick={(event) => openModal(event)}>Crear primer cliente</Link>}</div>
      </div>)}
    </div>
    {result.kind === "found" && <nav className={styles.pagination} aria-label="Páginas de clientes"
      onClick={(event) => { if (disabled) event.preventDefault(); }}>
      <div><p>{result.rows.length ? `${(applied.page - 1) * PAGE_SIZE + 1}–${(applied.page - 1) * PAGE_SIZE + result.rows.length} de ${result.count} clientes` : `0 de ${result.count} clientes`}</p>
        <span>Página {applied.page} · {result.count} clientes</span></div>
      <div className={styles.actions}>
        {applied.page > 1 ? <Link aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} href={listPath(applied, applied.page - 1)}>Anterior</Link> : <button disabled>Anterior</button>}
        {applied.page * PAGE_SIZE < result.count ? <Link aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} href={listPath(applied, applied.page + 1)}>Siguiente</Link> : <button disabled>Siguiente</button>}
      </div>
    </nav>}
    {detail && <ClientDetails client={detail.client} returnTo={returnTo} opener={detail.opener} onClose={() => setDetail(null)}
      onEdit={(event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault(); const selected = detail;
        flushSync(() => setDetail(null));
        selected.opener.focus();
        beginModal(selected.client, selected.opener);
      }} />}
    {modal && <ClientModal {...modal} action={saveClient} deleteAction={deleteClient} returnTo={returnTo} onClose={() => setModal(null)}
      onDeleted={() => { savedFocus.current = { opener: modalOpener.current, snapshot: result }; setModal(null);
        const nextPage = result.kind === "found" ? Math.min(applied.page, Math.max(1, Math.ceil((result.count - 1) / PAGE_SIZE))) : applied.page;
        startTransition(() => { if (nextPage !== applied.page) router.replace(listPath(applied, nextPage)); else router.refresh(); }); }}
      onSaved={() => { savedFocus.current = { opener: modalOpener.current, snapshot: result }; setModal(null); startTransition(() => router.refresh()); }} />}
  </section>;
}
