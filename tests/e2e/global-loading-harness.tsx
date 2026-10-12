import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { ClientModal } from "../../src/components/clients/client-modal";
import { GlobalLoading, RouteLoading, useLoadingOperation } from "../../src/components/ui/global-loading";
import { NotificationProvider, useNotification } from "../../src/components/ui/notifications";
import { PageError, PageNotFound } from "../../src/components/ui/recovery";
import { confirmed } from "../clients/fixture";
import "../../src/app/globals.css";

declare global { interface Window { loadingHarness: { settle: () => void; overlap: () => void; unmount: () => void; calls: () => number } } }
function Harness() {
  const [modal, setModal] = useState(false), [route, setRoute] = useState(false);
  const [recovery, setRecovery] = useState<"error" | "missing" | null>(null);
  const run = useLoadingOperation("save"), notify = useNotification();
  const calls = useRef(0);
  useEffect(() => {
    window.loadingHarness = { settle: () => {}, overlap: () => setRoute(true), unmount: () => { setRoute(false); setModal(false); }, calls: () => calls.current };
  }, []);
  return <><button onClick={() => setModal(true)}>Editar</button>
    <button onClick={() => notify("Cliente actualizado", "Nombre confirmado muy largo para comprobar lectura y reflujo sin perder información en una pantalla pequeña.")}>Notificar</button>
    <button onClick={() => setRecovery("error")}>Error de página</button><button onClick={() => setRecovery("missing")}>Página ausente</button>
    {recovery === "error" && <PageError reset={() => setRecovery(null)} />}{recovery === "missing" && <PageNotFound />}
    {route && <RouteLoading operation="clients" />}
    {modal && <ClientModal client={confirmed} requestId="00000000-0000-4000-8000-000000000001" initialContact="" returnTo="/clientes"
      onClose={() => setModal(false)} onSaved={() => { setRoute(true); setModal(false); }} action={async () => {
        calls.current++;
        await run(() => new Promise<void>((resolve) => { window.loadingHarness.settle = resolve; }));
        if (new URLSearchParams(window.location.search).has("success")) return { status: "success", client: confirmed };
        return { status: "error", message: "Error recuperable", retry: false };
      }} />}
    <GlobalLoading />
  </>;
}
createRoot(document.getElementById("root")!).render(<NotificationProvider><Harness /></NotificationProvider>);
