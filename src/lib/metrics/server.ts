import "server-only";
import { requireMember } from "@/lib/auth/require-member";
import { decodeMetrics, type MetricsResult } from "./model";
import { parseMetricsQuery, type MetricsSearchParams } from "./query";

export async function getDashboardMetrics(params: MetricsSearchParams, now = new Date()): Promise<MetricsResult> {
  const { client } = await requireMember();
  const parsed = parseMetricsQuery(params, now);
  if (!parsed.ok) return { kind: "invalid", message: parsed.message };
  const query = parsed.query;
  try {
    const { data, error } = await client.rpc("dashboard_metrics", {
      p_from: query.from, p_until: query.until, p_grouping: query.grouping,
    });
    const metrics = error ? null : decodeMetrics(data, query);
    if (metrics) return metrics;
  } catch { /* Provider details stay on the server boundary. */ }
  return { kind: "unavailable", query };
}
