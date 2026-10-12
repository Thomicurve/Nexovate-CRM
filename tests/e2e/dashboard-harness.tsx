import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { Dashboard } from "../../src/components/dashboard/dashboard";
import { GlobalLoading } from "../../src/components/ui/global-loading";
import type { MetricsResult } from "../../src/lib/metrics/model";
import "../../src/app/globals.css";

declare global { interface Window { metricsHarness: { push: (path: string) => Promise<void>; refresh: () => Promise<void> } } }
window.metricsHarness = { async push() {}, async refresh() {} };
async function read(path: string): Promise<MetricsResult> { return (await fetch(`/__fixture${new URL(path, location.href).search}`)).json(); }
function Harness({ initial }: { initial: MetricsResult }) {
  const [result, setResult] = useState(initial), [params, setParams] = useState(Object.fromEntries(new URLSearchParams(location.search)));
  useEffect(() => { Object.assign(window.metricsHarness, {
    async push(path: string) { const next = await read(path); history.pushState(history.state, "", path); setParams(Object.fromEntries(new URL(path, location.href).searchParams)); setResult(next); },
    async refresh() { setResult(await read(location.href)); },
  }); }, []);
  return <main><Dashboard result={result} params={params} /><GlobalLoading /></main>;
}
void read(location.href).then((initial) => createRoot(document.getElementById("root")!).render(<Harness initial={initial} />));
