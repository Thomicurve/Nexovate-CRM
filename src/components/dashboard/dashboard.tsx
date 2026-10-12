"use client";
import { LoadingLink as Link } from "@/components/ui/loading-navigation";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import type { MetricsComparison, MetricsQuery, MetricsResult } from "@/lib/metrics/model";
import { metricsPreset, previousMetricsQuery, parseMetricsQuery, type MetricsSearchParams } from "@/lib/metrics/query";
import { MetricChart, MetricPeriods, formatPeriod } from "./metric-chart";
import { usePendingLoading } from "@/components/ui/global-loading";
import styles from "./dashboard.module.css";

const titles = ["Contactados", "Reuniones", "Cerrados"];
const groups = [["day", "Día"], ["month", "Mes"], ["year", "Año"]] as const;
const number = new Intl.NumberFormat("es-AR");
function Controls({ query, from, until, refreshing }: { query: MetricsQuery; from: string; until: string; refreshing: boolean }) {
  const router = useRouter();
  const [draftFrom, setFrom] = useState(from), [draftUntil, setUntil] = useState(until);
  const [error, setError] = useState(""), [draftGroup, setGroup] = useState(query.grouping);
  const [pending, startTransition] = useTransition();
  usePendingLoading(pending, "metrics");
  function apply(next: MetricsQuery) {
    const parsed = parseMetricsQuery({ desde: next.from, hasta: next.until, agrupacion: next.grouping });
    if (!parsed.ok) { setError(parsed.message); return; }
    setError("");
    const params = new URLSearchParams({ desde: next.from, hasta: next.until, agrupacion: next.grouping });
    startTransition(() => router.push(`/dashboard?${params}`));
  }
  return <div>
    <form className={styles.controls} noValidate onSubmit={(event) => { event.preventDefault(); apply({ grouping: draftGroup, from: draftFrom, until: draftUntil }); }}>
      <div className={styles.dates}>
        <label>Desde<input type="date" name="desde" min="1900-01-01" max="9999-12-31" required value={draftFrom}
          aria-invalid={!!error} onChange={(event) => setFrom(event.target.value)} disabled={pending || refreshing} /></label>
        <label>Hasta<input type="date" name="hasta" min="1900-01-01" max="9999-12-31" required value={draftUntil}
          aria-invalid={!!error} onChange={(event) => setUntil(event.target.value)} disabled={pending || refreshing} /></label>
      </div>
      <fieldset className={styles.group}><legend>Agrupar por</legend><div>
        {groups.map(([grouping, label]) => <button key={grouping} type="button" aria-pressed={draftGroup === grouping}
          disabled={pending || refreshing} onClick={() => setGroup(grouping)}>{label}</button>)}
      </div></fieldset>
      <button className={styles.primary} type="submit" disabled={pending || refreshing}>Aplicar rango</button>
    </form>
    <div className={styles.presets} aria-label="Períodos rápidos">{[["seven", "Últimos siete días"], ["month", "Mes actual"], ["previous-month", "Mes anterior"]].map(([preset, label]) =>
      <button type="button" key={preset} disabled={pending || refreshing} onClick={() => {
        const next = metricsPreset(preset as "seven" | "month" | "previous-month");
        if (!next) { setError("Ese período está fuera del rango admitido (1900 a 9999)."); return; }
        setFrom(next.from); setUntil(next.until); setError("");
      }}>{label}</button>)}</div>
    <p className={styles.hint}>Fechas y agrupación en borrador. Aplicar rango confirma ambos.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}

function comparisonText(current: number, previous: number | undefined) {
  if (previous === undefined) return "Comparación no disponible";
  const delta = current - previous, absolute = `${delta > 0 ? "+" : ""}${number.format(delta)} hitos`;
  if (previous === 0) return `${absolute} · base anterior: 0; sin porcentaje`;
  const percent = delta / previous * 100;
  return `${absolute} · ${percent > 0 ? "+" : ""}${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(percent)} % frente al período anterior`;
}

export function Dashboard({ result: incoming, params }: { result: MetricsResult; params: MetricsSearchParams }) {
  const router = useRouter();
  const [result, setResult] = useState(incoming), [seenIncoming, setSeenIncoming] = useState(incoming);
  const [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState(false);
  const [pending, startTransition] = useTransition();
  usePendingLoading(pending, "metrics");
  const [seenPending, setSeenPending] = useState(false);
  usePendingLoading(refreshing, "metrics");
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
  const comparison: MetricsComparison | undefined = hasTotals ? result.comparison : undefined;
  const previousQuery = hasTotals ? comparison?.query ?? previousMetricsQuery(query) : null;
  const empty = hasTotals && result.metrics.every((metric) => metric.historicalTotal === 0);
  const emptyRange = result.kind === "ready" && !empty && result.metrics.every((metric) => metric.rangeTotal === 0);
  const changeRange = () => firstDate.current?.querySelector("input")?.focus();
  return <div className={styles.dashboard} aria-busy={refreshing || pending}>
    <div className={styles.heading}><div><h1>Dashboard</h1><p className={styles.hint}>La actividad de tu cartera, en una sola vista.</p></div><button type="button" className={styles.refreshButton} disabled={refreshing || pending} onClick={refresh}>
      {refreshing || pending ? "Actualizando…" : "Actualizar"}</button></div>
    <div ref={firstDate}><Controls key={`${from}/${until}/${query.grouping}`} query={query} from={from} until={until} refreshing={refreshing || pending} /></div>
    {refreshError && hasTotals && <div className={styles.refreshError}>
      <p className={styles.error} role="alert">No pudimos actualizar las métricas. Se conservan los últimos datos.</p>
      <button type="button" className={styles.refreshButton} disabled={refreshing || pending} onClick={refresh}>Reintentar actualización</button></div>}
    {result.kind === "invalid" ? <p className={styles.hint}>Sin período aplicado. Revisá las fechas y la agrupación.</p> :
      <p className={styles.hint} aria-live="polite">Período aplicado: {formatPeriod(query.from, "day")} a {formatPeriod(query.until, "day")} ·
        {` Agrupación: ${groups.find(([key]) => key === query.grouping)![1]}. Horario de Buenos Aires.`}</p>}
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
    {hasTotals && <p className={styles.hint}>{previousQuery ? `Comparación anterior: ${formatPeriod(previousQuery.from, "day")} a ${formatPeriod(previousQuery.until, "day")}. Igual cantidad de días inclusivos.` :
      "Comparación no disponible: el período anterior queda fuera del rango admitido (1900 a 9999)."}</p>}
    {hasTotals && <div className={styles.metrics}>{result.metrics.map((metric, index) => <section className={styles.metric}
      key={metric.status} aria-labelledby={`metric-${index}`}>
      <div className={styles.totals}><h2 id={`metric-${index}`}>{titles[index]}</h2>
        <p className={styles.value} aria-label={`${titles[index]} en el rango seleccionado`}>{number.format(metric.rangeTotal)}</p><p className={styles.hint}>En el rango seleccionado</p>
        <p className={styles.historical}>{number.format(metric.historicalTotal)} históricos</p>
      </div>
      <p className={styles.comparison}>{comparisonText(metric.rangeTotal, comparison?.kind === "ready" ? comparison.metrics[index]?.rangeTotal : undefined)}</p>
    </section>)}</div>}
    {result.kind === "ready" && <section className={styles.evolution} aria-labelledby="evolution-title">
      <header><h2 id="evolution-title">Evolución de hitos</h2><p className={styles.hint}>Cantidad de clientes por primer hito y período. Áreas independientes, sin sumar etapas.</p></header>
      <MetricChart metrics={result.metrics} grouping={query.grouping} />
      <MetricPeriods metrics={result.metrics} grouping={query.grouping} />
    </section>}
    <p className={styles.hint}>Cada cliente cuenta una sola vez por etapa, en su primer hito. Salir no resta y regresar no duplica.</p>
  </div>;
}
