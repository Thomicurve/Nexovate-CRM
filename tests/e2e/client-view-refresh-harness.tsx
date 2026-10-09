import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useState } from "react";
import { ClientList } from "../../src/components/clients/client-list";
import { Dashboard } from "../../src/components/dashboard/dashboard";
import { listPath, type ListResult } from "../../src/lib/clients/filters";
import type { MetricsResult } from "../../src/lib/metrics/model";
import "../../src/app/globals.css";

declare global { interface Window { crmHarness: { refresh: () => Promise<void>; push: (path: string) => void } } }
window.crmHarness = { refresh: async () => {}, push: (path) => window.location.assign(path) };
function Harness({ initial }: { initial: ListResult | MetricsResult }) {
  const [result, setResult] = useState(initial);
  const read = useCallback(async () => {
    const response = await fetch(`/__fixture${window.location.search}`);
    setResult(await response.json());
  }, []);
  useEffect(() => { window.crmHarness.refresh = read; }, [read]);
  if (window.location.pathname === "/dashboard") return <Dashboard result={result as MetricsResult} params={Object.fromEntries(new URLSearchParams(window.location.search))} />;
  const clients = result as ListResult;
  return <ClientList key={clients.kind === "invalid" ? "invalid" : listPath({ ...clients.filters, view: "kanban" })} result={clients} />;
}
async function boot() {
  const response = await fetch(`/__fixture${window.location.search}`);
  createRoot(document.getElementById("root")!).render(<Harness initial={await response.json()} />);
}
void boot();
