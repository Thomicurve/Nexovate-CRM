"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { LoadingLink as Link, useLoadingFormNavigation } from "@/components/ui/loading-navigation";
import { usePanelMotion } from "@/components/ui/motion";
import { listPath, type Filters, type ClientSort } from "@/lib/clients/filters";
import { STATUSES } from "@/lib/clients/model";
import styles from "./clients.module.css";

export function ClientFilters({ applied, search, disabled, trigger, onClose }: {
  applied: Filters; search: string; disabled: boolean; trigger: RefObject<HTMLButtonElement | null>; onClose: () => void;
}) {
  const [draft, setDraft] = useState(applied), panel = useRef<HTMLElement>(null), title = useRef<HTMLHeadingElement>(null);
  const navigate = useLoadingFormNavigation();
  usePanelMotion(panel, true);
  useEffect(() => {
    const opener = trigger.current;
    title.current?.focus();
    return () => { queueMicrotask(() => { if (opener?.isConnected) opener.focus(); }); };
  }, [trigger]);
  return <section className={styles.filterPanel} aria-labelledby="filter-title" id="client-filters" ref={panel}
    onKeyDown={(event) => { if (event.key === "Escape" && !disabled) { event.preventDefault(); onClose(); } }}>
    <h2 id="filter-title" tabIndex={-1} ref={title}>Filtrar clientes</h2>
    <form action="/clientes" method="get" onSubmit={navigate}>
      <fieldset className={styles.filterFields} disabled={disabled}>
        <input type="hidden" name="nombre" value={search} /><input type="hidden" name="vista" value={applied.view} />
        <input type="hidden" name="orden" value={draft.sort} /><input type="hidden" name="direccion" value={draft.direction} />
        <fieldset className={styles.stateOptions}><legend>Estado</legend>{STATUSES.map((state) =>
          <label key={state} className={draft.statuses.includes(state) ? styles.selectedState : ""}>
            <input type="checkbox" name="estado" value={state} checked={draft.statuses.includes(state)} onChange={() => {
              setDraft({ ...draft, statuses: STATUSES.filter((value) => value === state ? !draft.statuses.includes(value) : draft.statuses.includes(value)) });
            }} />{state}
          </label>)}</fieldset>
        <div className={styles.filterDates}>{[["from", "desde", "Contacto desde"], ["until", "hasta", "Contacto hasta"]].map(([key, name, label]) =>
          <div className={styles.field} key={name}><label htmlFor={name}>{label}</label>
            <input id={name} name={name} type="date" min="1900-01-01" max="9999-12-31" value={draft[key as "from" | "until"]}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></div>)}</div>
        <p className={styles.hint}>Fechas de contacto. Incluye ambos días, en horario de Buenos Aires.</p>
        <div className={styles.field}><label htmlFor="client-sort">Ordenar por</label>
          <select id="client-sort" value={`${draft.sort}:${draft.direction}`} onChange={(event) => {
            const [sort, direction] = event.target.value.split(":") as [ClientSort, "asc" | "desc"]; setDraft({ ...draft, sort, direction });
          }}>
            <option value="nombre:asc">Nombre, A a Z</option><option value="nombre:desc">Nombre, Z a A</option>
            <option value="contacto:desc">Contacto, más reciente</option><option value="contacto:asc">Contacto, más antiguo</option>
            <option value="reunion:asc">Reunión, más próxima</option><option value="reunion:desc">Reunión, más lejana</option>
          </select></div>
        <div className={styles.actions}><button type="submit">Aplicar filtros</button>
          <Link href={listPath({ ...applied, name: "", statuses: [], from: "", until: "", page: 1 })} aria-disabled={disabled}
            tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault(); }}>Limpiar filtros</Link>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancelar</button></div>
      </fieldset>
    </form>
  </section>;
}
