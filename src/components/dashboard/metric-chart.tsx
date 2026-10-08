"use client";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Metric, MetricsQuery } from "@/lib/metrics/model";
import styles from "./dashboard.module.css";

export function formatPeriod(start: string, grouping: MetricsQuery["grouping"], short = false) {
  const [year, month, day] = start.split("-").map(Number);
  if (grouping === "year") return String(year);
  if (grouping === "day") return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}${short ? "" : `/${year}`}`;
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", calendar: "iso8601",
    month: "short", year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
export function MetricChart({ title, buckets, grouping }: { title: string; buckets: Metric["buckets"]; grouping: MetricsQuery["grouping"] }) {
  return <div className={styles.chart}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 300, height: 124 }}>
      <BarChart data={buckets} accessibilityLayer title={`${title} por período`} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#243750" />
        <XAxis dataKey="start" tickFormatter={(start: string) => formatPeriod(start, grouping, true)} tickLine={false} axisLine={false}
          interval="preserveStartEnd" minTickGap={32} tick={{ fill: "#a6b7ce", fontSize: 12 }} />
        <YAxis allowDecimals={false} hide domain={[0, "auto"]} />
        <Tooltip cursor={{ fill: "#243750" }} labelFormatter={(start) => formatPeriod(String(start), grouping)}
          formatter={(value) => [new Intl.NumberFormat("es-AR").format(Number(value)), title]}
          contentStyle={{ background: "#121f35", border: "1px solid #597697", borderRadius: 6, color: "#e6edf8" }} />
        <Bar dataKey="count" fill="#386bc0" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={72}>
          {buckets.map((bucket, index) => <Cell key={bucket.start} fill={index === buckets.length - 1 ? "#85b6f5" : "#386bc0"} />)}
          {buckets.length <= 31 && <LabelList dataKey="count" position="top" fill="#e6edf8" fontSize={13} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
