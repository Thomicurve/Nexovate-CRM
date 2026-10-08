import { Dashboard } from "@/components/dashboard/dashboard";
import { getDashboardMetrics } from "@/lib/metrics/server";
import type { MetricsSearchParams } from "@/lib/metrics/query";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<MetricsSearchParams> }) {
  const params = await searchParams;
  const result = await getDashboardMetrics(params);
  return <Dashboard result={result} params={params} />;
}
