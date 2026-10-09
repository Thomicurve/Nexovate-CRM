import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useState } from "react";
import { ClientList } from "../../src/components/clients/client-list";
import { ClientModal } from "../../src/components/clients/client-modal";
import { NotificationProvider } from "../../src/components/ui/notifications";
import { saveClient } from "../../src/app/(crm)/clientes/actions";
import { utcToLocal } from "../../src/lib/clients/dates";
import { safeReturnPath } from "../../src/lib/clients/model";
import type { ListResult } from "../../src/lib/clients/filters";
import "../../src/app/globals.css";

window.crmHarness = { refresh: async () => {}, push: (path) => window.location.assign(path) };
Object.assign(window.crmHarness, { replace: (path: string) => window.location.assign(path) });
function Harness({ initial }: { initial: ListResult }) {
  const [result, setResult] = useState(initial);
  const read = useCallback(async () => { setResult(await (await fetch(`/__fixture${window.location.search}`)).json()); }, []);
  useEffect(() => { window.crmHarness.refresh = read; }, [read]);
  const path = window.location.pathname, direct = path !== "/clientes";
  const client = path.endsWith("/editar") && result.kind === "found" ? result.rows[0] : undefined;
  return <NotificationProvider>{direct ? <ClientModal action={saveClient} client={client} requestId={crypto.randomUUID()}
    initialContact={utcToLocal(new Date().toISOString())} returnTo={safeReturnPath(new URLSearchParams(window.location.search).get("returnTo") ?? "")} /> :
    <ClientList result={result} />}</NotificationProvider>;
}
async function boot() {
  const result = await (await fetch(`/__fixture${window.location.search}`)).json();
  createRoot(document.getElementById("root")!).render(<Harness initial={result} />);
}
void boot();
