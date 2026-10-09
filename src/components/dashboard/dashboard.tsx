"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import type { MetricsQuery, MetricsResult } from "@/lib/metrics/model";
import { parseMetricsQuery, type MetricsSearchParams } from "@/lib/metrics/query";
import { MetricChart, formatPeriod } from "./metric-chart";
import styles from "./dashboard.module.css";

const titles = ["Contactados", "Reuniones agendadas", "Cerrados"];
const groups = [["day", "Día"], ["month", "Mes"], ["year", "Año"]] as const;
const number = new Intl.NumberFormat("es-AR");
function Controls({ query, from, until, refreshing }: { query: MetricsQuery; from: string; until: string; refreshing: boolean }) {
  const router = useRouter();
  const [draftFrom, setFrom] = useState(from), [draftUntil, setUntil] = useState(until);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function apply(next: MetricsQuery) {
    const parsed = parseMetricsQuery({ desde: next.from, hasta: next.until, agrupacion: next.grouping });
    if (!parsed.ok) { setError(parsed.message); return; }
    setError("");
    const params = new URLSearchParams({ desde: next.from, hasta: next.until, agrupacion: next.grouping });
    startTransition(() => router.push(`/dashboard?${params}`));
  }
  return <div>
    <form className={styles.controls} noValidate onSubmit={(event) => { event.preventDefault(); apply({ ...query, from: draftFrom, until: draftUntil }); }}>
      <div className={styles.dates}>
        <label>Desde<input type="date" name="desde" min="1900-01-01" max="9999-12-31" required value={draftFrom}
          aria-invalid={!!error} onChange={(event) => setFrom(event.target.value)} disabled={pending || refreshing} /></label>
        <label>Hasta<input type="date" name="hasta" min="1900-01-01" max="9999-12-31" required value={draftUntil}
          aria-invalid={!!error} onChange={(event) => setUntil(event.target.value)} disabled={pending || refreshing} /></label>
      </div>
      <fieldset className={styles.group}><legend>Agrupar por</legend><div>
        {groups.map(([grouping, label]) => <button key={grouping} type="button" aria-pressed={query.grouping === grouping}
          disabled={pending || refreshing} onClick={() => apply({ ...query, grouping })}>{label}</button>)}
      </div></fieldset>
      <button className={styles.primary} type="submit" disabled={pending || refreshing}>Aplicar rango</button>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {pending && <p role="status" className={styles.hint}>Actualizando métricas…</p>}
  </div>;
}

export function Dashboard({ result: incoming, params }: { result: MetricsResult; params: MetricsSearchParams }) {
  const router = useRouter();
  const [result, setResult] = useState(incoming), [seenIncoming, setSeenIncoming] = useState(incoming);
  const [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [seenPending, setSeenPending] = useState(false);
  const refreshGuard = useRef(false);
  useLayoutEffect(() => { refreshGuard.current = refreshing; }, [refreshing]);
  if (incoming !== seenIncoming) {
    setSeenIncoming(incoming);
    const failed = refreshing && incoming.kind === "unavailable";
    if (!failed || (result.kind !== "ready" && result.kind !== "too_many_buckets")) setResult(incoming);
    setRefreshError(failed); setRefreshing(false);
  }
  if (pending !== seenPending) {
    setSeenPending(pending);
    if (!pending && refreshing && incoming === seenIncoming) {
      setRefreshing(false); setRefreshError(true);
    }
  }
  function refresh() {
    if (refreshGuard.current || pending) return;
    refreshGuard.current = true;
    setRefreshing(true); setRefreshError(false);
    startTransition(() => router.refresh());
  }
  const firstDate = useRef<HTMLDivElement>(null);
  const defaults = parseMetricsQuery({});
  if (!defaults.ok) return <p role="alert">No pudimos preparar el rango de fechas.</p>;
  const query = result.kind === "invalid" ? defaults.query : result.kind === "unavailable" ? result.query : result;
  const from = result.kind === "invalid" && typeof params.desde === "string" ? params.desde : query.from;
  const until = result.kind === "invalid" && typeof params.hasta === "string" ? params.hasta : query.until;
  const hasTotals = result.kind === "ready" || result.kind === "too_many_buckets";
  const empty = hasTotals && result.metrics.every((metric) => metric.historicalTotal === 0);
  const emptyRange = result.kind === "ready" && !empty && result.metrics.every((metric) => metric.rangeTotal === 0);
  const changeRange = () => firstDate.current?.querySelector("input")?.focus();
  return <div className={styles.dashboard} aria-busy={refreshing || pending}>
    <div className={styles.heading}><h1>Dashboard</h1><button type="button" className={styles.refreshButton} disabled={refreshing || pending} onClick={refresh}>
      {refreshing || pending ? "Actualizando…" : "Actualizar"}</button></div>
    <div ref={firstDate}><Controls key={`${from}/${until}/${query.grouping}`} query={query} from={from} until={until} refreshing={refreshing || pending} /></div>
    {(refreshing || pending) && <p role="status" className={styles.hint}>Actualizando métricas…</p>}
    {refreshError && hasTotals && <div className={styles.refreshError}>
      <p className={styles.error} role="alert">No pudimos actualizar las métricas. Se conservan los últimos datos.</p>
      <button type="button" className={styles.refreshButton} disabled={refreshing || pending} onClick={refresh}>Reintentar actualización</button></div>}
    <p className={styles.hint} aria-live="polite">{formatPeriod(query.from, "day")} a {formatPeriod(query.until, "day")} ·
      {` Agrupación: ${groups.find(([key]) => key === query.grouping)![1]}. Horario de Buenos Aires.`}</p>
    {result.kind === "invalid" && <p className={styles.error} role="alert">{result.message}</p>}
    {result.kind === "unavailable" && <div className={styles.state}>
      <p className={styles.error} role="alert">No pudimos cargar las métricas. Reintentá en unos instantes.</p>
      <button type="button" disabled={refreshing || pending} onClick={refresh}>Reintentar</button>
    </div>}
    {result.kind === "too_many_buckets" && <p className={styles.notice} role="status">
      El rango contiene {number.format(result.bucketCount)} períodos. {result.grouping === "year" ? "Reducí el rango para ver la evolución." :
        "Elegí una agrupación más amplia (Mes o Año) o reducí el rango para ver la evolución."} Los totales están completos.
    </p>}
    {empty && <div className={styles.state}><p>Todavía no hay actividad</p><Link href="/clientes/nuevo">Nuevo cliente</Link></div>}
    {emptyRange && <div className={styles.state}><p>No hay nuevos hitos en estas fechas</p><button onClick={changeRange}>Cambiar rango</button></div>}
    {hasTotals && <div className={styles.metrics}>{result.metrics.map((metric, index) => <section className={styles.metric}
      key={metric.status} aria-labelledby={`metric-${index}`}>
      <div className={styles.totals}><h2 id={`metric-${index}`}>{titles[index]}</h2>
        <p className={styles.value} aria-label={`${titles[index]} en el rango seleccionado`}>{number.format(metric.rangeTotal)}</p><p className={styles.hint}>En el rango seleccionado</p>
        <p className={styles.historical}>{number.format(metric.historicalTotal)} históricos</p>
      </div>
      {result.kind === "ready" && "buckets" in metric && <div className={styles.evolution}>
        <MetricChart title={titles[index]} buckets={metric.buckets} grouping={query.grouping} />
        <details className={styles.details}><summary>Ver datos por período</summary><div className={styles.tableScroll}>
          <table aria-label={`${titles[index]} por período`}><thead><tr><th scope="col">Período</th><th scope="col">Clientes</th></tr></thead>
            <tbody>{metric.buckets.map((bucket) => <tr key={bucket.start}><th scope="row">{formatPeriod(bucket.start, query.grouping)}</th>
              <td>{number.format(bucket.count)}</td></tr>)}</tbody>
          </table></div></details>
      </div>}
    </section>)}</div>}
    <p className={styles.hint}>Cada cliente cuenta una sola vez por etapa, en su primer hito. Salir no resta y regresar no duplica.</p>
  </div>;
}
