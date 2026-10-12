import "server-only";
import { requireMember } from "@/lib/auth/require-member";
import { decodeMetrics, type MetricsComparison, type MetricsQuery, type MetricsResult } from "./model";
import { parseMetricsQuery, previousMetricsQuery, type MetricsSearchParams } from "./query";

export async function getDashboardMetrics(params: MetricsSearchParams, now = new Date()): Promise<MetricsResult> {
  const { client } = await requireMember();
  const parsed = parseMetricsQuery(params, now);
  if (!parsed.ok) return { kind: "invalid", message: parsed.message };
  const query = parsed.query;
  async function read(range: MetricsQuery) {
    try {
    const { data, error } = await client.rpc("dashboard_metrics", {
      p_from: range.from, p_until: range.until, p_grouping: range.grouping,
    });
    return error ? null : decodeMetrics(data, range);
    } catch { return null; /* Provider details stay on the server boundary. */ }
  }
  const current = await read(query);
  if (!current) return { kind: "unavailable", query };
  const previousQuery = previousMetricsQuery(query), previous = previousQuery ? await read(previousQuery) : null;
  const comparison: MetricsComparison = previous && previousQuery ? { kind: "ready", query: previousQuery,
    metrics: previous.metrics.map(({ status, historicalTotal, rangeTotal }) => ({ status, historicalTotal, rangeTotal })) } :
    { kind: "unavailable", query: previousQuery };
  return { ...current, comparison };
}
