"use client";
import { useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Metric, MetricsQuery } from "@/lib/metrics/model";
import { usePanelMotion } from "@/components/ui/motion";
import styles from "./dashboard.module.css";

export function formatPeriod(start: string, grouping: MetricsQuery["grouping"], short = false) {
  const [year, month, day] = start.split("-").map(Number);
  if (grouping === "year") return String(year);
  if (grouping === "day") return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}${short ? "" : `/${year}`}`;
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", calendar: "iso8601",
    month: "short", year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
const series = [
  { title: "Contactados", color: "#2D78FF", pattern: undefined, label: "trazo continuo", opacity: 0.24 },
  { title: "Reuniones", color: "#79AAFF", pattern: "8 5", label: "trazo discontinuo", opacity: 0.18 },
  { title: "Cerrados", color: "#B5D3FF", pattern: "2 5", label: "trazo punteado", opacity: 0.12 },
];
export function MetricChart({ metrics, grouping }: { metrics: Metric[]; grouping: MetricsQuery["grouping"] }) {
  const rows = metrics[0].buckets.map((bucket, index) => ({ start: bucket.start,
    Contactados: bucket.count, Reuniones: metrics[1].buckets[index].count, Cerrados: metrics[2].buckets[index].count }));
  return <>
    <ul className={styles.legend} aria-label="Series y patrones">{series.map((item) => <li key={item.title}>
      <span aria-hidden="true" className={styles.swatch} style={{ borderColor: item.color, borderStyle: item.pattern === undefined ? "solid" : item.title === "Reuniones" ? "dashed" : "dotted" }} />
      <span>{item.title} · {item.label}</span></li>)}</ul>
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 300, height: 290 }}>
        <AreaChart data={rows} accessibilityLayer title="Evolución de hitos por período" margin={{ top: 12, right: 8, left: 0, bottom: 12 }}>
          <CartesianGrid vertical={false} stroke="#26344D" />
          <XAxis dataKey="start" tickFormatter={(start: string) => formatPeriod(start, grouping, true)} tickLine={false} axisLine={false}
            interval="preserveStartEnd" minTickGap={48} tick={{ fill: "#A6B5CC", fontSize: 12 }} />
          <YAxis allowDecimals={false} width={48} domain={[0, "auto"]} tickLine={false} axisLine={false}
            tick={{ fill: "#A6B5CC", fontSize: 12 }} label={{ value: "Cantidad", angle: -90, position: "insideLeft", fill: "#A6B5CC", fontSize: 12 }} />
          <Tooltip labelFormatter={(start) => formatPeriod(String(start), grouping)} formatter={(value, name) => [new Intl.NumberFormat("es-AR").format(Number(value)), name]}
            contentStyle={{ background: "#162238", border: "1px solid #667891", borderRadius: 6, color: "#EAF1FF" }} />
          {series.map((item) => <Area key={item.title} dataKey={item.title} type="linear" baseValue={0} stroke={item.color} strokeWidth={2.5}
            strokeDasharray={item.pattern} fill={item.color} fillOpacity={item.opacity} dot={false} activeDot={false} isAnimationActive={false} />)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </>;
}
export function MetricPeriods({ metrics, grouping }: { metrics: Metric[]; grouping: MetricsQuery["grouping"] }) {
  const [open, setOpen] = useState(false), table = useRef<HTMLDivElement>(null);
  usePanelMotion(table, open);
  return <details className={styles.details} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Ver datos por período</summary>{open && <div ref={table} className={styles.tableScroll} role="region" aria-label="Tabla de hitos desplazable" tabIndex={0}>
      <table aria-label="Hitos por período"><thead><tr><th scope="col">Período</th>{series.map((item) => <th scope="col" key={item.title}>{item.title}</th>)}</tr></thead>
        <tbody>{metrics[0].buckets.map((bucket, i) => <tr key={bucket.start}><th scope="row">{formatPeriod(bucket.start, grouping)}</th>
          {metrics.map((metric) => <td key={metric.status}>{new Intl.NumberFormat("es-AR").format(metric.buckets[i].count)}</td>)}</tr>)}</tbody>
      </table></div>}
  </details>;
}
